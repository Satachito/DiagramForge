//	In-app AI assistant ( BYOK — bring your own Anthropic API key ).
//
//	Static / no-backend: the browser calls the Anthropic API directly with the
//	user's own key ( stored in localStorage ), so there is no server, no account,
//	and no billing on our side — the user pays Anthropic directly. Edits are
//	applied through window.DF.apply ( ai-api.js ), so each turn is normal undo /
//	redraw, identical to the MCP path. Responses stream token-by-token.

const
ENDPOINT		= 'https://api.anthropic.com/v1/messages'
,	KEY_STORE		= 'df-anthropic-key'
,	MODEL_STORE		= 'df-anthropic-model'
,	MAX_TURNS		= 6		//	guard against runaway tool loops

//	Concise, implementation-accurate contract ( mirrors AI.md ). The live model
//	is appended per request so the assistant edits against current state.
const
SYSTEM			= `You edit a live DiagramForge diagram by calling the apply_ops tool.

A .cde model is { nodes, links }.
Node  = [ ID, shape, paint ]      shape: { type:"rect"|"ellipse"|"rhombus"|"SVG"|"PNG", cX, cY, rH, rV, radii?, html?, style?, SVG?, PNG? }
                                  cX/cY = center, rH/rV = half-width/half-height ( size ≈ 2*rH × 2*rV ). Y axis points down.
                                  paint: { fill?, stroke?, lineWidth?, lineDash?, ... } ( optional {} )
Link  = [ [ fromID, toID ], attributes, paint ]
                                  attributes: { headF?, headT? ( false | "triangle"|"open"|"hollow"|"diamond"|"diamondHollow"|"circle"|"circleHollow" ), anchorF?, anchorT? ( T B L R TL TR BL BR ), corner? ( "bezier"|"sharp"|"arc"|"straight" ) }

apply_ops ops ( one op = one undo step ):
  { op:"addNode",    id, area, paint? }
  { op:"updateNode", id, area, paint?, newId? }   // replaces the WHOLE shape+paint, not a patch
  { op:"removeNode", id }
  { op:"restack",    id, toFront? }
  { op:"addLink",    from, to, ends?, paint? }
  { op:"updateLink", from, to, newFrom?, newTo?, ends?, paint? }
  { op:"removeLink", from, to }
  { op:"setCanvas",  width, height }
"area" is the shape object; "ends" is the link attributes object.

Rules:
- Keep node IDs stable; every link must reference existing IDs.
- Prefer rect / ellipse / rhombus. Never invent or rewrite SVG / PNG payloads — move/resize via cX/cY/rH/rV only.
- updateNode replaces the full shape — read the current value first and resend every field you want to keep.
- After applying, the tool returns any validation issues; fix them and call apply_ops again.
- When the request is done, reply with a one-line summary of what you changed. Do not ask for confirmation before editing.`

const
TOOLS			= [
	{
		name		: 'apply_ops'
	,	description	: 'Apply one or more edit operations to the live diagram.'
	,	input_schema: {
			type		: 'object'
		,	properties	: { ops: { type: 'array', items: { type: 'object' } } }
		,	required	: [ 'ops' ]
		}
	}
]

//	--- API key helpers --------------------------------------------------------
const	getKey		= () => localStorage.getItem( KEY_STORE ) || ''
const	setKey		= _ => _ ? localStorage.setItem( KEY_STORE, _ ) : localStorage.removeItem( KEY_STORE )

//	--- single streaming Messages API call -------------------------------------
//	Reconstructs the assistant content blocks from the SSE stream while calling
//	onTextStart / onTextDelta so text can render live. Returns { content, stop_reason }.
const
streamClaude	= async ( key, model, messages, { onTextStart, onTextDelta } ) => {
	const
	res = await fetch(
		ENDPOINT
	,	{
			method	: 'POST'
		,	headers	: {
				'content-type'							: 'application/json'
			,	'x-api-key'								: key
			,	'anthropic-version'						: '2023-06-01'
			,	'anthropic-dangerous-direct-browser-access'	: 'true'
			}
		,	body	: JSON.stringify( {
				model
			,	max_tokens	: 4096
			,	system		: `${ SYSTEM }\n\nCurrent model ( JSON ):\n${ JSON.stringify( window.DF.getModel() ) }`
			,	tools		: TOOLS
			,	messages
			,	stream		: true
			} )
		}
	)
	if	( !res.ok ) {
		const	j = await res.json().catch( () => null )
		throw new Error( j?.error?.message || `HTTP ${ res.status }` )
	}

	const
	reader		= res.body.getReader()
	,	decoder		= new TextDecoder
	,	blocks		= []	//	reconstructed content blocks, by index
	,	jsonByIndex	= []	//	accumulated tool_use input JSON, by index
	let	stopReason	= null
	,	buf			= ''

	const
	handle		= data => {
		switch ( data.type ) {
		case 'content_block_start':
			blocks[ data.index ] = data.content_block
			if	( data.content_block.type === 'text' )	onTextStart()
			break
		case 'content_block_delta':
			if	( data.delta.type === 'text_delta' ) {
				blocks[ data.index ].text += data.delta.text
				onTextDelta( blocks[ data.index ].text )
			} else if ( data.delta.type === 'input_json_delta' ) {
				jsonByIndex[ data.index ] = ( jsonByIndex[ data.index ] || '' ) + data.delta.partial_json
			}
			break
		case 'content_block_stop': {
			const	b = blocks[ data.index ]
			if	( b && b.type === 'tool_use' )
				b.input = jsonByIndex[ data.index ] ? JSON.parse( jsonByIndex[ data.index ] ) : {}
			break
		}
		case 'message_delta':
			if	( data.delta?.stop_reason )	stopReason = data.delta.stop_reason
			break
		case 'error':
			throw new Error( data.error?.message || 'stream error' )
		}
	}

	for	( ;; ) {
		const	{ value, done } = await reader.read()
		if	( done )	break
		buf += decoder.decode( value, { stream: true } )
		let	i
		while	( ( i = buf.indexOf( '\n\n' ) ) !== -1 ) {
			const
			chunk	= buf.slice( 0, i )
			buf		= buf.slice( i + 2 )
			const	line = chunk.split( '\n' ).find( _ => _.startsWith( 'data:' ) )
			if	( line )	handle( JSON.parse( line.slice( 5 ).trim() ) )
		}
	}
	return	{ content: blocks, stop_reason: stopReason }
}

//	--- panel wiring -----------------------------------------------------------
//	Expects these element IDs in index.html:
//	AI_KEY, AI_KEY_TOGGLE, AI_KEY_CLEAR, AI_MODEL, AI_INPUT, AI_SEND, AI_LOG
export const
initAIPanel		= () => {
	const
	logLine		= ( role, text ) => {
		const	div = document.createElement( 'div' )
		div.className	= `ai-msg ai-${ role }`
		div.textContent	= text
		AI_LOG.append( div )
		AI_LOG.scrollTop = AI_LOG.scrollHeight
		return	div
	}

	//	restore persisted key / model
	AI_KEY.value	= getKey()
	AI_MODEL.value	= localStorage.getItem( MODEL_STORE ) || AI_MODEL.value
	AI_KEY.onchange		= () => setKey( AI_KEY.value.trim() )
	AI_MODEL.onchange	= () => localStorage.setItem( MODEL_STORE, AI_MODEL.value )
	AI_KEY_TOGGLE.onclick	= () => AI_KEY.type = AI_KEY.type === 'password' ? 'text' : 'password'
	AI_KEY_CLEAR.onclick	= () => { AI_KEY.value = ''; setKey( '' ); AI_KEY.focus() }

	const
	run			= async () => {
		const	prompt = AI_INPUT.value.trim()
		if	( !prompt )	return
		const	key = AI_KEY.value.trim()
		if	( !key ) {
			logLine( 'error', 'Set your Anthropic API key first ( the key field above ).' )
			return
		}
		setKey( key )

		logLine( 'user', prompt )
		AI_INPUT.value	= ''
		AI_SEND.disabled	= true
		let	pending = logLine( 'status', '…thinking' )
		const	clearPending = () => { if ( pending ) { pending.remove(); pending = null } }

		const	messages = [ { role: 'user', content: prompt } ]
		try {
			for	( let turn = 0; turn < MAX_TURNS; turn++ ) {
				let	liveEl = null
				const	res = await streamClaude( key, AI_MODEL.value, messages, {
					onTextStart	: () => { clearPending(); liveEl = logLine( 'assistant', '' ) }
				,	onTextDelta	: full => { if ( liveEl ) { liveEl.textContent = full; AI_LOG.scrollTop = AI_LOG.scrollHeight } }
				} )

				if	( res.stop_reason !== 'tool_use' ) break

				messages.push( { role: 'assistant', content: res.content } )

				//	run every requested apply_ops and feed results back
				const	results = []
				for	( const block of res.content ) {
					if	( block.type !== 'tool_use' ) continue
					let		payload
					try {
						const	ops = block.input?.ops ?? []
						const	issues = await window.DF.apply( ops )
						payload = JSON.stringify( { applied: ops.length, issues } )
					} catch ( er ) {
						payload = JSON.stringify( { error: String( er?.message || er ) } )
					}
					results.push( {
						type		: 'tool_result'
					,	tool_use_id	: block.id
					,	content		: payload
					} )
				}
				messages.push( { role: 'user', content: results } )
			}
		} catch ( er ) {
			logLine( 'error', String( er?.message || er ) )
		} finally {
			clearPending()
			AI_SEND.disabled = false
		}
	}

	AI_SEND.onclick	= run
	AI_INPUT.onkeydown = ev => {
		//	Enter sends, Shift+Enter inserts a newline
		if	( ev.key === 'Enter' && !ev.shiftKey ) { ev.preventDefault(); void run() }
	}
}
