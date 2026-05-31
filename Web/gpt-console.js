import	app, {
	Save
,	ByAI
} from './Application.js'
import	{
	SearchIcons
,	GetIconPayload
} from './cloud-icons.js'

const
AI_SYSTEM_PROMPT = [
	'You edit a DiagramForge model object for a cloud diagram editor.'
,	'Return JSON only.'
,	'Always return an object with shape {"model":{"nodes":[...],"links":[...]},"summary":"..."}'
,	'The model schema is: nodes = [ID, area_data, path_operation], links = [from_ID, {headF, headT, anchorF, anchorT}, to_ID, path_operation].'
,	'area_data = {type, cX, cY, rH, rV, radii, innerHTML, style, SVG, PNG}.'
,	'path_operation = {fill, stroke, yellow, lineWidth, lineCap, lineJoin, miterLimit}.'
,	'headF and headT are booleans (arrowheads at from and to). anchorF and anchorT are null or one of T, L, B, R, TL, TR, BL, BR.'
,	'The user payload includes base_model, base_model_source, and current_model.'
,	'Treat base_model as the document to edit.'
,	'If base_model_source is "empty_model", create the minimum complete diagram that satisfies the instruction.'
,	'SUPPORTED TYPES: rect, ellipse, PNG, SVG.'
,	'Prefer rect and ellipse unless the user explicitly requests PNG or SVG.'
,	'Never answer with architecture prose alone.'
,	'Put any explanation in summary, but always return a drawable model with concrete nodes and links.'
,	'When the user asks for vendor or service icons, use the available tools before editing the model.'
,	'Use search_icons to find relevant icons from the loaded AWS, Azure, and GCP archives.'
,	'Use get_icon_payload to fetch the exact SVG or PNG node payload for the selected icon.'
,	'Keep the smallest possible valid change that satisfies the instruction.'
,	'Preserve unrelated nodes, links, IDs, and coordinates unless the instruction explicitly asks to change them.'
,	'When adding nodes, use unique string IDs that do not collide with existing IDs.'
,	'When adding nodes, place them near related nodes and keep the diagram readable.'
,	'Ensure every link references existing node IDs.'
,	'Existing SVG and PNG nodes may be sent without embedded image bytes.'
,	'For existing SVG and PNG nodes, edit coordinates only and preserve the existing node IDs and type.'
,	'Do not recreate or rewrite embedded SVG or PNG payloads for existing image nodes.'
,	'Do not invent extra explanation outside the JSON response.'
].join( ' ' )
const
TOOLS = [
	{
		type: 'function'
	,	function: {
			name: 'search_icons'
		,	description: 'Search loaded cloud icon archives by query, provider, and file type.'
		,	parameters: {
				type: 'object'
			,	additionalProperties: false
			,	properties: {
					query: {
						type: 'string'
					,	description: 'Search text such as lock, api gateway, database, or vm.'
					}
				,	provider: {
						type: 'string'
					,	description: 'Optional provider filter. Use AWS, Azure, or GCP.'
					}
				,	type: {
						type: 'string'
					,	enum: [ 'any', 'svg', 'png' ]
					}
				,	limit: {
						type: 'integer'
					,	minimum: 1
					,	maximum: 20
					}
				}
			}
		}
	}
,	{
		type: 'function'
	,	function: {
			name: 'get_icon_payload'
		,	description: 'Get the exact node payload for one icon so it can be inserted into model.nodes.'
		,	parameters: {
				type: 'object'
			,	additionalProperties: false
			,	properties: {
					icon_id: {
						type: 'string'
					,	description: 'The icon_id returned by search_icons.'
					}
				,	path: {
						type: 'string'
					,	description: 'Optional raw archive path if icon_id is not available.'
					}
				,	provider: {
						type: 'string'
					,	description: 'Optional provider name when path is used.'
					}
				}
			}
		}
	}
]

const
ExtractJSON = _ => {
	const
	match = _.match( /```(?:json)?\s*([\s\S]*?)```/i )
	const
	text = ( match ? match[ 1 ] : _ ).trim()
	try {
		return JSON.parse( text )
	} catch ( er ) {
		const
		i = text.indexOf( '{' )
		const
		j = text.lastIndexOf( '}' )
		if ( i < 0 || j < i ) throw er
		return JSON.parse( text.slice( i, j + 1 ) )
	}
}
const
HasContent = model => Boolean(
	model
	&& Array.isArray( model.nodes )
	&& Array.isArray( model.links )
	&& ( model.nodes.length > 0 || model.links.length > 0 )
)
const
ASSET_TAGS = new Set( [ 'SVG', 'PNG' ] )
const
IsAssetNode = node => (
	Array.isArray( node )
	&& ASSET_TAGS.has( node[ 1 ]?.type )
)
const
AssetKey = ( id, tag ) => `${ id }::${ tag }`
const
CollectAssetPayloads = ( ...models ) => {
	const
	assets = new Map()
	models.forEach(
		model => {
			if ( !model || !Array.isArray( model.nodes ) ) return
			model.nodes.forEach(
				node => {
					if ( !IsAssetNode( node ) ) return
					const
					id = node[ 0 ]
					const
					tag = node[ 1 ].type
					const
					area = node[ 1 ]
					if ( !area || typeof area !== 'object' ) return
					if ( area[ tag ] == null ) return
					assets.set(
						AssetKey( id, tag )
					,	{ [ tag ]: area[ tag ] }
					)
				}
			)
		}
	)
	return assets
}
const
StripAssetPayloads = model => {
	if ( !model || !Array.isArray( model.nodes ) ) return model
	const
	copy = structuredClone( model )
	copy.nodes = copy.nodes.map(
		node => {
			if ( !IsAssetNode( node ) ) return node
			const
			tag = node[ 1 ].type
			const
			area = node[ 1 ]
			if ( !area || typeof area !== 'object' || area[ tag ] == null ) return node
			const
			nextArea = { ...area }
			delete nextArea[ tag ]
			nextArea.asset_data_omitted = true
			nextArea.asset_source = tag
			return [
				node[ 0 ]
			,	nextArea
			,	node[ 2 ]
			]
		}
	)
	return copy
}
const
RestoreAssetPayloads = ( model, assets ) => {
	if ( !model || !Array.isArray( model.nodes ) || !( assets instanceof Map ) || assets.size === 0 ) {
		return model
	}
	const
	copy = structuredClone( model )
	copy.nodes = copy.nodes.map(
		node => {
			if ( !IsAssetNode( node ) ) return node
			const
			id = node[ 0 ]
			const
			tag = node[ 1 ].type
			const
			asset = assets.get( AssetKey( id, tag ) )
			if ( !asset ) return node
			const
			area = node[ 1 ] && typeof node[ 1 ] === 'object' ? { ...node[ 1 ] } : {}
			delete area.asset_data_omitted
			delete area.asset_source
			if ( area[ tag ] == null ) {
				area[ tag ] = asset[ tag ]
			}
			return [
				node[ 0 ]
			,	area
			,	node[ 2 ]
			]
		}
	)
	return copy
}
const
CorrectionMessage = () => JSON.stringify(
	{
		correction: [
			'Your previous answer did not include a drawable model.'
		,	'Return JSON only.'
		,	'Do not answer with prose-only architecture notes.'
		,	'Populate model.nodes and model.links with a concrete drawable diagram.'
		,	'Return a complete valid model object with nodes and links.'
		]
	}
)
const
PREFERRED_MODELS = [
	'gpt-5'
,	'gpt-5-mini'
,	'gpt-5.1-chat-latest'
,	'gpt-4.1'
,	'gpt-4.1-mini'
,	'gpt-4o'
,	'gpt-4o-mini'
]
const
IsChatModel = id => {
	const
	name = String( id ?? '' ).trim().toLowerCase()
	if ( !name ) return false
	if ( !(
		name.startsWith( 'gpt-' )
	||	name.startsWith( 'o1' )
	||	name.startsWith( 'o3' )
	||	name.startsWith( 'o4' )
	) ) return false
	return ![
		'audio'
	,	'realtime'
	,	'transcribe'
	,	'tts'
	,	'whisper'
	,	'embedding'
	,	'moderation'
	,	'image'
	,	'dall'
	].some( _ => name.includes( _ ) )
}
/*
const
CompareModels = ( A, B ) => {
	const
	a = String( A ?? '' )
	const
	b = String( B ?? '' )
	const
	iA = PREFERRED_MODELS.indexOf( a )
	const
	iB = PREFERRED_MODELS.indexOf( b )
	if ( iA >= 0 || iB >= 0 ) {
		if ( iA < 0 ) return 1
		if ( iB < 0 ) return -1
		return iA - iB
	}
	return a.localeCompare( b )
}
*/
const
ParseArguments = _ => {
	if ( !_ ) return {}
	try {
		return JSON.parse( _ )
	} catch ( er ) {
		throw new Error( 'Tool arguments are not valid JSON.' )
	}
}
const
ToolLabel = name => (
	name === 'search_icons'
	?	'searching icons'
	:	name === 'get_icon_payload'
	?	'loading icon payload'
	:	`running ${ name }`
)
const
RunTool = async ( name, args ) => {
	switch ( name ) {
		case 'search_icons':
			return await SearchIcons( args )
		case 'get_icon_payload':
			return await GetIconPayload( args )
		default:
			throw new Error( `Unknown tool: ${ name }` )
	}
}

export default class
GPTConsole extends HTMLElement {

	connectedCallback() {
		if ( this.shadowRoot ) return

		const
		$ = this.attachShadow( { mode: 'open' } )
		$.innerHTML = `
			<style>
			:host {
				display: block;
			}
			.wrap {
				display: grid;
				gap: 8px;
			}
			.controls {
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
				align-items: center;
			}
			textarea,
			input,
			select,
			button {
				box-sizing: border-box;
				font: inherit;
			}
			textarea {
				width: 100%;
				height: 160px;
			}
			#status {
				height: 64px;
			}
			#api-key {
				flex: 1 1 320px;
				min-width: 240px;
			}
			</style>
			<div class="wrap">
				<textarea id="prompt" placeholder="Edit with GPT. Example: Create an AWS-based ID portal using icons from the loaded archives."></textarea>
				<div class="controls">
					<input id="api-key" type="password" placeholder="OpenAI API key">
					<select id="model">
						<option value="gpt-5">gpt-5</option>
						<option value="gpt-5-mini">gpt-5-mini</option>
						<option value="gpt-5.1-chat-latest">gpt-5.1-chat-latest</option>
						<option value="gpt-4.1">gpt-4.1</option>
						<option value="gpt-4.1-mini">gpt-4.1-mini</option>
						<option value="gpt-4o">gpt-4o</option>
						<option value="gpt-4o-mini">gpt-4o-mini</option>
					</select>
					<button id="ask">Ask AI</button>
				</div>
				<textarea id="status" readonly>AI: idle</textarea>
			</div>
		`

		this.$prompt	= $.getElementById( 'prompt' )
		this.$apiKey	= $.getElementById( 'api-key' )
		this.$model		= $.getElementById( 'model' )
		this.$ask		= $.getElementById( 'ask' )
		this.$status	= $.getElementById( 'status' )

		this.$apiKey.value = this.getAttribute( 'api-key' ) ?? ''
		this.defaultModel = this.getAttribute( 'model' ) ?? 'gpt-5'
		this.SetModelOptions( PREFERRED_MODELS, this.defaultModel )

		this.$ask.onclick = () => this.AskAI()
		this.$apiKey.addEventListener(
			'change'
		,	() => this.LoadModels().catch( er => console.error( er ) )
		)
		this.$apiKey.addEventListener(
			'blur'
		,	() => this.LoadModels().catch( er => console.error( er ) )
		)
		this.$prompt.addEventListener(
			'keydown'
		,	ev => {
				if ( ev.isComposing ) return
				if ( ev.key !== 'Enter' ) return
				if ( !( ev.metaKey || ev.ctrlKey ) ) return
				ev.preventDefault()
				this.$ask.click()
			}
		)
		this.LoadModels().catch( er => console.error( er ) )
	}

	SetStatus( _ ) {
		this.$status.value = _
	}

	SetModelOptions( names, preferred = '' ) {
		const
		selected = preferred || this.$model.value || this.defaultModel || 'gpt-5'
		this.$model.replaceChildren()
		names.forEach(
			name => {
				const
				option = document.createElement( 'option' )
				option.value = name
				option.textContent = name
				this.$model.appendChild( option )
			}
		)
		if ( names.includes( selected ) ) {
			this.$model.value = selected
		} else
		if ( names.length ) {
			this.$model.value = names[ 0 ]
		}
	}

	async LoadModels() {
		const
		apiKey = this.$apiKey?.value.trim()
		if ( !apiKey ) return
		const
		previousStatus = this.$status.value
		this.SetStatus( 'AI: loading models...' )
		try {
			const
			R = await fetch(
				'https://api.openai.com/v1/models'
			,	{
					headers: {
						'Authorization'	: `Bearer ${ apiKey }`
					}
				}
			)
			const
			$ = await R.json()
			if ( !R.ok ) {
				throw new Error( $.error?.message ?? 'OpenAI models request failed.' )
			}
			const
			models = ( $.data ?? [] )
			.map( _ => _.id )
			.filter( IsChatModel )
			.sort( ( p, q ) => p.localeCompare( q ) )
			if ( models.length ) {
				this.SetModelOptions( models, this.$model.value || this.defaultModel )
			}
			this.SetStatus( previousStatus === 'AI: loading models...' ? 'AI: idle' : previousStatus )
		} catch ( er ) {
			this.SetStatus( previousStatus === 'AI: loading models...' ? 'AI: idle' : previousStatus )
			throw er
		}
	}

	async AskAI() {
		const
		apiKey = this.$apiKey.value.trim()
		const
		modelName = this.$model.value
		const
		prompt = this.$prompt.value.trim()

		if ( !apiKey ) {
			this.SetStatus( 'AI: API key is required.' )
			return
		}
		if ( !prompt ) {
			this.SetStatus( 'AI: prompt is required.' )
			return
		}

		this.$ask.disabled = true
		this.SetStatus( `AI: thinking with ${ modelName }...` )

		try {
			const
			currentModelRaw = HasContent( app.model ) ? structuredClone( app.model ) : null
			const
			baseModelRaw = currentModelRaw ?? { nodes: [], links: [] }
			const
			assetPayloads = CollectAssetPayloads( baseModelRaw, currentModelRaw )
			const
			currentModel = StripAssetPayloads( currentModelRaw )
			const
			baseModel = StripAssetPayloads( baseModelRaw )
			const
			baseModelSource = currentModel ? 'current_model' : 'empty_model'
			const
			messages = [
				{
					role: 'system'
				,	content: AI_SYSTEM_PROMPT
				}
			,	{
					role: 'user'
				,	content: JSON.stringify(
						{
							instruction: prompt
						,	requirements: [
								'Return the full edited model.'
							,	'Edit base_model.'
							,	'If base_model_source is current_model, preserve existing node IDs unless change is required.'
							,	'If base_model_source is current_model, keep geometry stable unless the request asks for moving or resizing.'
							,	'If base_model_source is empty_model, create the minimum complete diagram that satisfies the request.'
							,	'For architecture examples, add only the minimum coherent components needed.'
							,	'When a cloud icon is needed, call tools to search and fetch the exact icon payload.'
							,	'For existing SVG and PNG nodes, do not regenerate image bytes. Move or resize them by editing coordinates only.'
							,	'Do not return summary-only prose. Always include a concrete drawable model.'
							]
						,	base_model_source: baseModelSource
						,	base_model: baseModel
						,	current_model: currentModel
						}
					)
				}
			]
			let
			content = ''
			let
			turn = 0
			while ( turn < 8 ) {
				this.SetStatus( `AI: thinking with ${ modelName }...` )
				const
				R = await fetch(
					'https://api.openai.com/v1/chat/completions'
				,	{
						method: 'POST'
					,	headers: {
							'Authorization'	: `Bearer ${ apiKey }`
						,	'Content-Type'	: 'application/json'
						}
					,	body: JSON.stringify(
							{
								model: modelName
							,	response_format: { type: 'json_object' }
							,	tools: TOOLS
							,	tool_choice: 'auto'
							,	messages
							}
						)
					}
				)
				const
				$ = await R.json()
				if ( !R.ok ) {
					throw new Error( $.error?.message ?? 'OpenAI API request failed.' )
				}

				const
				message = $.choices?.[ 0 ]?.message
				const
				toolCalls = message?.tool_calls ?? []
				if ( toolCalls.length > 0 ) {
					messages.push(
						{
							role: 'assistant'
						,	content: message.content ?? ''
						,	tool_calls: toolCalls
						}
					)
					for ( const toolCall of toolCalls ) {
						const
						name = toolCall.function?.name ?? ''
						this.SetStatus( `AI: ${ ToolLabel( name ) }...` )
						const
						result = await RunTool(
							name
						,	ParseArguments( toolCall.function?.arguments )
						)
						messages.push(
							{
								role: 'tool'
							,	tool_call_id: toolCall.id
							,	content: JSON.stringify( result )
							}
						)
					}
					turn++
					continue
				}

				const
				draftContent = message?.content ?? ''
				if ( typeof draftContent !== 'string' || !draftContent.trim() ) {
					throw new Error( 'OpenAI returned no editable model.' )
				}
				const
				draftParsed = ExtractJSON( draftContent )
				const
				draftModel = draftParsed.model ?? draftParsed
				if ( !HasContent( draftModel ) && turn < 7 ) {
					messages.push(
						{
							role: 'assistant'
						,	content: draftContent
						}
					)
					messages.push(
						{
							role: 'user'
						,	content: CorrectionMessage()
						}
					)
					turn++
					continue
				}

				content = draftContent
				break
			}
			if ( typeof content !== 'string' || !content.trim() ) {
				throw new Error( 'OpenAI returned no editable model.' )
			}

			const
			parsed = ExtractJSON( content )
			const
			model = RestoreAssetPayloads(
				parsed.model ?? parsed
			,	assetPayloads
			)
			if ( !HasContent( model ) ) {
				throw new Error( 'AI returned an empty model.' )
			}
			ByAI( model )
			localStorage.setItem( 'tokyo.828.diagramforge', Save() )
			this.SetStatus( `AI: ${ parsed.summary ?? 'applied.' }` )
		} catch ( er ) {
			console.error( er )
			this.SetStatus( `AI: ${ er.message }` )
		}

		this.$ask.disabled = false
	}
}

customElements.define( 'gpt-console', GPTConsole )
