//	Shared HTTP client for zu-server RPC ( used by zu-mcp.mjs ).

import { ZU_BASE } from './zu-paths.mjs'

export const
zuFetch	= async ( path, init ) => {
	const
	res = await fetch( `${ ZU_BASE }${ path }`, init )
	if	( !res.ok ) {
		const	text = await res.text().catch( () => '' )
		throw new Error( text || `${ res.status } ${ path }` )
	}
	return	res.headers.get( 'content-type' )?.includes( 'json' )
		? res.json()
		: res.text()
}

export const
zuStatus	= () => zuFetch( '/__zu/status' )

export const
zuGetModel	= () => zuFetch( '/__zu/model' )

export const
zuRpc	= ( method, params = {}, timeout ) => zuFetch( '/__zu/rpc', {
	method	: 'POST'
,	headers	: { 'Content-Type': 'application/json' }
,	body	: JSON.stringify( { method, params, timeout } )
} )
