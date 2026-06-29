//	In-app AI assistant — Claude ( Anthropic ), BYOK.
//
//	The browser calls the Anthropic API directly with the user's own key
//	( stored in localStorage, via anthropic-dangerous-direct-browser-access ),
//	so there is no server, account, or billing on our side. Shared UI + tool
//	loop live in ai-core.js; this module only owns the Anthropic request shape,
//	its SSE streaming, and the message threading.

import { OPS_SCHEMA, systemWithModel, initPanel, readSSE } from './ai-core.js'

const
ENDPOINT		= 'https://api.anthropic.com/v1/messages'
,	TOOLS			= [
	{
		name		: 'apply_ops'
	,	description	: 'Apply one or more edit operations to the live diagram.'
	,	input_schema: OPS_SCHEMA
	}
]

//	Stream one assistant turn; render text live; reconstruct the content blocks.
//	Returns { assistant, toolCalls:[ { id, input } ] }.
const
streamTurn		= async ( key, model, messages, { onTextStart, onTextDelta } ) => {
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
			,	system		: systemWithModel()
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
	blocks		= []	//	reconstructed content blocks, by index
	,	jsonByIndex	= []	//	accumulated tool_use input JSON, by index
	await readSSE( res, raw => {
		const	data = JSON.parse( raw )
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
		case 'error':
			throw new Error( data.error?.message || 'stream error' )
		}
	} )

	const
	toolCalls	= blocks.filter( b => b && b.type === 'tool_use' ).map( b => ( { id: b.id, input: b.input } ) )
	return	{ assistant: { role: 'assistant', content: blocks }, toolCalls }
}

export const
initAIPanel		= () => initPanel( {
	storeKey	: 'zu-anthropic-key'
,	storeModel	: 'zu-anthropic-model'
,	el			: {
		key			: AI_KEY
	,	keyToggle	: AI_KEY_TOGGLE
	,	keyClear	: AI_KEY_CLEAR
	,	model		: AI_MODEL
	,	input		: AI_INPUT
	,	send		: AI_SEND
	,	log			: AI_LOG
	}
,	initMessages	: prompt => [ { role: 'user', content: prompt } ]
,	streamTurn
	//	Anthropic: tool results go back in a single user message, as tool_result blocks
,	toolResultMessages	: results => [ {
		role	: 'user'
	,	content	: results.map( r => ( { type: 'tool_result', tool_use_id: r.id, content: r.content } ) )
	} ]
} )
