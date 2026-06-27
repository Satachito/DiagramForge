//	In-app AI assistant — OpenAI, BYOK.
//
//	Same design as the Claude panel ( ai-panel.js ): the browser calls the OpenAI
//	API directly with the user's own key ( stored in localStorage ), no server /
//	account / billing on our side. Shared UI + tool loop live in ai-core.js; this
//	module owns the OpenAI Chat Completions request shape, its SSE streaming, and
//	the message threading ( function calling → tool-role results ).

import { OPS_SCHEMA, systemWithModel, initPanel, readSSE } from './ai-core.js'

const
ENDPOINT		= 'https://api.openai.com/v1/chat/completions'
,	TOOLS			= [
	{
		type		: 'function'
	,	function	: {
			name		: 'apply_ops'
		,	description	: 'Apply one or more edit operations to the live diagram.'
		,	parameters	: OPS_SCHEMA
		}
	}
]

//	Stream one assistant turn; render text live; accumulate function-call deltas.
//	Returns { assistant, toolCalls:[ { id, input } ] }.
const
streamTurn		= async ( key, model, messages, { onTextStart, onTextDelta } ) => {
	const
	res = await fetch(
		ENDPOINT
	,	{
			method	: 'POST'
		,	headers	: {
				'content-type'	: 'application/json'
			,	authorization	: `Bearer ${ key }`
			}
		,	body	: JSON.stringify( {
				model
			,	stream		: true
			,	tools		: TOOLS
			,	tool_choice	: 'auto'
			,	messages	: [ { role: 'system', content: systemWithModel() }, ...messages ]
			} )
		}
	)
	if	( !res.ok ) {
		const	j = await res.json().catch( () => null )
		throw new Error( j?.error?.message || `HTTP ${ res.status }` )
	}

	let	content		= ''
	,	started		= false
	const	calls		= []	//	function calls, by delta index: { id, name, args }
	await readSSE( res, raw => {
		const	d = JSON.parse( raw ).choices?.[ 0 ]?.delta
		if	( !d )	return
		if	( d.content ) {
			if	( !started )	{ onTextStart(); started = true }
			content += d.content
			onTextDelta( content )
		}
		if	( d.tool_calls ) for ( const tc of d.tool_calls ) {
			const	c = calls[ tc.index ] ||= { id: '', name: '', args: '' }
			if	( tc.id )					c.id	= tc.id
			if	( tc.function?.name )		c.name	= tc.function.name
			if	( tc.function?.arguments )	c.args	+= tc.function.arguments
		}
	} )

	const
	used		= calls.filter( Boolean )
	,	assistant	= {
		role		: 'assistant'
	,	content		: content || null
	,	...( used.length && { tool_calls: used.map( c => ( {
			id			: c.id
		,	type		: 'function'
		,	function	: { name: c.name, arguments: c.args }
		} ) ) } )
	}
	,	toolCalls	= used.map( c => ( { id: c.id, input: c.args ? JSON.parse( c.args ) : {} } ) )
	return	{ assistant, toolCalls }
}

export const
initOpenAIPanel	= () => initPanel( {
	storeKey	: 'df-openai-key'
,	storeModel	: 'df-openai-model'
,	el			: {
		key			: OAI_KEY
	,	keyToggle	: OAI_KEY_TOGGLE
	,	keyClear	: OAI_KEY_CLEAR
	,	model		: OAI_MODEL
	,	input		: OAI_INPUT
	,	send		: OAI_SEND
	,	log			: OAI_LOG
	}
,	initMessages	: prompt => [ { role: 'user', content: prompt } ]
,	streamTurn
	//	OpenAI: one tool-role message per tool call
,	toolResultMessages	: results => results.map( r => ( {
		role			: 'tool'
	,	tool_call_id	: r.id
	,	content			: r.content
	} ) )
} )
