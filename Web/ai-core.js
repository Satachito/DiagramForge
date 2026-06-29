//	Shared core for the in-app AI assistant panels ( Claude + OpenAI ).
//
//	Provider-neutral: the .zu / ops contract, the ops tool schema, the SSE line
//	reader, and the panel UI + tool loop. Each provider module supplies a
//	streamTurn() that talks to its own API and normalizes tool calls to
//	{ id, input }. Edits go through window.ZU.apply ( ai-api.js ), so each turn
//	is one undo step + redraw, identical to the MCP path.

//	Concise, implementation-accurate contract ( mirrors AI.md ). The live model
//	is appended per request so the assistant edits against current state.
export const
SYSTEM			= `You edit a live Zukai diagram by calling the apply_ops tool.

A .zu model is { nodes, links }.
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

//	JSON schema for the single apply_ops tool ( shared by both providers ).
export const
OPS_SCHEMA		= {
	type		: 'object'
,	properties	: { ops: { type: 'array', items: { type: 'object' } } }
,	required	: [ 'ops' ]
}

//	System prompt with the current live model appended ( fresh every request ).
export const
systemWithModel	= () => `${ SYSTEM }\n\nCurrent model ( JSON ):\n${ JSON.stringify( window.ZU.getModel() ) }`

//	Read an SSE response, calling onEvent( rawDataString ) per `data:` line.
//	Stops on `data: [DONE]` ( OpenAI ) or stream end ( Anthropic ).
export const
readSSE			= async ( res, onEvent ) => {
	const
	reader		= res.body.getReader()
	,	decoder		= new TextDecoder
	let	buf			= ''
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
			if	( !line )	continue
			const	data = line.slice( 5 ).trim()
			if	( data === '[DONE]' )	return
			onEvent( data )
		}
	}
}

const	MAX_TURNS	= 6		//	guard against runaway tool loops

//	Wire one panel. `provider` supplies element refs, localStorage keys, and the
//	API-specific streamTurn / message threading. See ai-panel.js ( Claude ) and
//	ai-panel-openai.js ( OpenAI ).
export const
initPanel		= provider => {
	const
	{ el, storeKey, storeModel } = provider
	,	setKey		= _ => _ ? localStorage.setItem( storeKey, _ ) : localStorage.removeItem( storeKey )
	,	logLine		= ( role, text ) => {
		const	div = document.createElement( 'div' )
		div.className	= `ai-msg ai-${ role }`
		div.textContent	= text
		el.log.append( div )
		el.log.scrollTop = el.log.scrollHeight
		return	div
	}

	//	restore persisted key / model
	el.key.value		= localStorage.getItem( storeKey ) || ''
	el.model.value		= localStorage.getItem( storeModel ) || el.model.value
	el.key.onchange		= () => setKey( el.key.value.trim() )
	el.model.onchange	= () => localStorage.setItem( storeModel, el.model.value )
	el.keyToggle.onclick	= () => el.key.type = el.key.type === 'password' ? 'text' : 'password'
	el.keyClear.onclick		= () => { el.key.value = ''; setKey( '' ); el.key.focus() }

	const
	run			= async () => {
		const	prompt = el.input.value.trim()
		if	( !prompt )	return
		const	key = el.key.value.trim()
		if	( !key ) {
			logLine( 'error', 'Set your API key first ( the key field above ).' )
			return
		}
		setKey( key )

		logLine( 'user', prompt )
		el.input.value	= ''
		el.send.disabled	= true
		let	pending = logLine( 'status', '…thinking' )
		const	clearPending = () => { if ( pending ) { pending.remove(); pending = null } }

		const	messages = provider.initMessages( prompt )
		try {
			for	( let turn = 0; turn < MAX_TURNS; turn++ ) {
				let	liveEl = null
				const	{ assistant, toolCalls } = await provider.streamTurn( key, el.model.value, messages, {
					onTextStart	: () => { clearPending(); liveEl = logLine( 'assistant', '' ) }
				,	onTextDelta	: full => { if ( liveEl ) { liveEl.textContent = full; el.log.scrollTop = el.log.scrollHeight } }
				} )

				if	( !toolCalls.length )	break

				messages.push( assistant )

				//	run every requested apply_ops and feed results back
				const	results = []
				for	( const tc of toolCalls ) {
					let		content
					try {
						const	ops = tc.input?.ops ?? []
						const	issues = await window.ZU.apply( ops )
						content = JSON.stringify( { applied: ops.length, issues } )
					} catch ( er ) {
						content = JSON.stringify( { error: String( er?.message || er ) } )
					}
					results.push( { id: tc.id, content } )
				}
				messages.push( ...provider.toolResultMessages( results ) )
			}
		} catch ( er ) {
			logLine( 'error', String( er?.message || er ) )
		} finally {
			clearPending()
			el.send.disabled = false
		}
	}

	el.send.onclick	= run
	el.input.onkeydown = ev => {
		//	Enter sends, Shift+Enter inserts a newline
		if	( ev.key === 'Enter' && !ev.shiftKey ) { ev.preventDefault(); void run() }
	}
}
