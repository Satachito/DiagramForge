//	Shared HTTP client for zu-server RPC ( used by zu-mcp.mjs ).

import { DF_BASE } from './zu-paths.mjs'

export const
dfFetch	= async ( path, init ) => {
	const
	res = await fetch( `${ DF_BASE }${ path }`, init )
	if	( !res.ok ) {
		const	text = await res.text().catch( () => '' )
		throw new Error( text || `${ res.status } ${ path }` )
	}
	return	res.headers.get( 'content-type' )?.includes( 'json' )
		? res.json()
		: res.text()
}

export const
dfStatus	= () => dfFetch( '/__df/status' )

export const
dfGetModel	= () => dfFetch( '/__df/model' )

export const
dfRpc	= ( method, params = {}, timeout ) => dfFetch( '/__df/rpc', {
	method	: 'POST'
,	headers	: { 'Content-Type': 'application/json' }
,	body	: JSON.stringify( { method, params, timeout } )
} )
