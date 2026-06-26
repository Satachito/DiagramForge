#!/usr/bin/env node
//	DiagramForge dev server: static Web/ + Samples live-reload over WebSocket.
//
//	Cursor (or any editor) saves a .cde → browser reloads that diagram in-place.
//
//	Usage (from repo root):
//	  node tools/df-server.mjs
//	  open http://localhost:8080/?cde=Samples/JSONs.cde

import { createServer	} from 'node:http'
import { createHash	} from 'node:crypto'
import { readFile, stat	} from 'node:fs/promises'
import { watch		} from 'node:fs'
import { createReadStream	} from 'node:fs'
import path from 'node:path'
import { fileURLToPath	} from 'node:url'

const
ROOT	= path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' )
,	WEB	= path.join( ROOT, 'Web' )
,	PORT	= Number( process.env.PORT ) || 8080
,	WS_PATH	= '/__df/ws'
,	clients	= new Set

const
MIME	= {
	'.html'	: 'text/html; charset=utf-8'
,	'.js'	: 'text/javascript; charset=utf-8'
,	'.css'	: 'text/css; charset=utf-8'
,	'.json'	: 'application/json; charset=utf-8'
,	'.cde'	: 'application/json; charset=utf-8'
,	'.svg'	: 'image/svg+xml'
,	'.png'	: 'image/png'
,	'.zip'	: 'application/zip'
,	'.ico'	: 'image/x-icon'
}

const
log	= ( ...a ) => console.log( '[df-server]', ...a )

const
cdePathFromAbs	= abs => {
	const
	rel = path.relative( WEB, abs )
	if	( rel.startsWith( '..' ) || path.isAbsolute( rel ) ) return null
	return	rel.split( path.sep ).join( '/' )
}

const
safeWebPath	= urlPath => {
	const
	clean = decodeURIComponent( urlPath.split( '?' )[ 0 ] )
	,	rel = clean.replace( /^\/+/, '' ) || 'index.html'
	,	abs = path.normalize( path.join( WEB, rel ) )
	if	( !abs.startsWith( WEB + path.sep ) && abs !== WEB ) return null
	return	abs
}

const
wsSend	= ( socket, text ) => {
	const
	data = Buffer.from( text )
	,	len = data.length
	let	header
	if	( len < 126 ) {
		header = Buffer.from( [ 0x81, len ] )
	} else if	( len < 65536 ) {
		header = Buffer.alloc( 4 )
		header[ 0 ] = 0x81
		header[ 1 ] = 126
		header.writeUInt16BE( len, 2 )
	} else {
		header = Buffer.alloc( 10 )
		header[ 0 ] = 0x81
		header[ 1 ] = 127
		header.writeBigUInt64BE( BigInt( len ), 2 )
	}
	socket.write( Buffer.concat( [ header, data ] ) )
}

const
broadcast	= msg => {
	const
	payload = JSON.stringify( msg )
	for	( const socket of clients ) {
		if	( !socket.destroyed ) wsSend( socket, payload )
	}
}

let
debounce = null
const
notifyCde	= abs => {
	const
	rel = cdePathFromAbs( abs )
	if	( !rel ) return
	clearTimeout( debounce )
	debounce = setTimeout( () => {
		log( 'cde-changed', rel )
		broadcast( { type: 'cde-changed', path: rel } )
	}, 80 )
}

const
watchCdeTree	= dir => {
	watch( dir, { recursive: true }, ( ev, name ) => {
		if	( !name || !name.endsWith( '.cde' ) ) return
		notifyCde( path.join( dir, name ) )
	} )
	log( 'watching', path.relative( ROOT, dir ) || '.' )
}

watchCdeTree( path.join( WEB, 'Samples' ) )

const
serveStatic	= async ( req, res ) => {
	const
	abs = safeWebPath( req.url )
	if	( !abs ) {
		res.writeHead( 403 ); res.end( 'Forbidden' ); return
	}
	try {
		const
		st = await stat( abs )
		if	( st.isDirectory() ) {
			res.writeHead( 302, { Location: req.url.replace( /\/?$/, '/' ) + 'index.html' } )
			res.end()
			return
		}
		const
		ext = path.extname( abs )
		res.writeHead( 200, {
			'Content-Type'		: MIME[ ext ] || 'application/octet-stream'
		,	'Cache-Control'		: ext === '.cde' ? 'no-store' : 'default'
		} )
		createReadStream( abs ).pipe( res )
	} catch {
		res.writeHead( 404 ); res.end( 'Not found' )
	}
}

const
acceptWs	= ( req, socket, head ) => {
	if	( req.url !== WS_PATH ) {
		socket.destroy()
		return
	}
	const
	key = req.headers[ 'sec-websocket-key' ]
	if	( !key ) {
		socket.destroy()
		return
	}
	const
	accept = createHash( 'sha1' )
		.update( key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11' )
		.digest( 'base64' )
	socket.write(
		'HTTP/1.1 101 Switching Protocols\r\n'
		+ 'Upgrade: websocket\r\n'
		+ 'Connection: Upgrade\r\n'
		+ `Sec-WebSocket-Accept: ${ accept }\r\n\r\n`
	)
	clients.add( socket )
	socket.on( 'close', () => clients.delete( socket ) )
	socket.on( 'error', () => clients.delete( socket ) )
	//	discard client frames — reload is server → browser only
	socket.on( 'data', () => {} )
}

const
server = createServer( ( req, res ) => {
	serveStatic( req, res ).catch( er => {
		log( 'error', er )
		res.writeHead( 500 ); res.end( 'Internal error' )
	} )
} )

server.on( 'upgrade', acceptWs )

server.listen( PORT, () => {
	log( `http://localhost:${ PORT }/` )
	log( `example: http://localhost:${ PORT }/?cde=Samples/JSONs.cde` )
} )

server.on( 'error', er => {
	if	( er.code === 'EADDRINUSE' ) {
		console.error(
			`[df-server] port ${ PORT } is already in use.\n`
			+ `  kill it:  lsof -ti:${ PORT } | xargs kill\n`
			+ `  or use:   PORT=${ PORT + 1 } node tools/df-server.mjs`
		)
		process.exit( 1 )
	}
	throw er
} )
