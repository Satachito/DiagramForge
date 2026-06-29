//	Live .zu reload + WebSocket RPC bridge to window.ZU ( tools/zu-server.mjs ).

import { Load	} from './Application.js'
import { CanvasSize	} from './main-editor.js'

let
watchPath = null
,	ws = null
,	uiRef = null

export const
getWatchPath	= () => watchPath

export const
setWatchPath	= path => {
	watchPath = path
	path && sessionStorage.setItem( 'zu-watch', path )
}

const
snapshot	= () => {
	const
	[ width, height ] = CanvasSize()
	return	{
		model			: window.ZU.getModel()
	,	canvas			: { width, height }
	,	watchPath
	}
}

const
pushSnapshot	= () => {
	if	( !ws || ws.readyState !== WebSocket.OPEN ) return
	ws.send( JSON.stringify( { type: 'model-update', ...snapshot() } ) )
}

const
MUTATING	= new Set( [ 'apply', 'setModel', 'autoLayout', 'addNode', 'updateNode', 'removeNode', 'addLink', 'updateLink', 'removeLink', 'restack', 'setCanvas' ] )

const
runRpc	= async ( method, params ) => {
	const
	ZU = window.ZU
	switch ( method ) {
	case 'getModel':
		return	snapshot()
	case 'apply':
		return	ZU.apply( params.ops )
	case 'validate':
		return	ZU.validate( params.model )
	case 'autoLayout':
		return	ZU.autoLayout( params )
	case 'setModel':
		return	ZU.setModel( params.model )
	case 'loadZu':
		await loadZuFile( params.path, uiRef ?? {} )
		return	snapshot()
	default: {
		const	fn = ZU[ method ]
		if	( typeof fn !== 'function' ) throw new Error( `unknown RPC method "${ method }"` )
		return	fn( params )
	}
	}
}

const
handleRpc	= async msg => {
	const	{ id, method, params = {} } = msg
	try {
		const
		result = await runRpc( method, params )
		ws.send( JSON.stringify( { type: 'rpc-result', id, result } ) )
		if	( MUTATING.has( method ) || ( method === 'apply' ) ) pushSnapshot()
	} catch ( er ) {
		ws.send( JSON.stringify( { type: 'rpc-error', id, error: String( er.message || er ) } ) )
	}
}

export const
loadZuFile	= async ( path, { SyncCanvasInputs, FILE_NAME } = {} ) => {
	const
	res = await fetch( new URL( path, import.meta.url ), { cache: 'no-store' } )
	if	( !res.ok ) throw new Error( `${ res.status } ${ path }` )
	await Load( await res.text() )
	setWatchPath( path )
	FILE_NAME && ( FILE_NAME.value = path.replace( /^.*\//, '' ) )
	SyncCanvasInputs?.()
	pushSnapshot()
}

const
connectBridge	= () => {
	if	( location.protocol !== 'http:' && location.protocol !== 'https:' ) return

	const
	proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
	,	url = `${ proto }//${ location.host }/__zu/ws`
	,	connect = () => {
		ws = new WebSocket( url )
		ws.onopen = () => {
			ws._everOpen = true
			ws.send( JSON.stringify( { type: 'editor-ready', ...snapshot() } ) )
		}
		ws.onmessage = async ev => {
			let	msg
			try { msg = JSON.parse( ev.data ) } catch { return }
			if	( msg.type === 'zu-changed' ) {
				if	( !watchPath || msg.path !== watchPath ) return
				try {
					await loadZuFile( watchPath, uiRef ?? {} )
				} catch ( er ) {
					console.error( '[live-reload]', er )
				}
				return
			}
			if	( msg.type === 'rpc' ) void handleRpc( msg )
		}
		ws.onclose = ev => { if ( ev.target._everOpen ) setTimeout( connect, 1500 ) }
	}
	connect()
}

export const
initLiveReload	= async ( ui, { Report } = {} ) => {
	uiRef = ui
	const
	fromUrl = new URLSearchParams( location.search ).get( 'zu' )
	,	fromStore = sessionStorage.getItem( 'zu-watch' )
	,	path = fromUrl || fromStore

	setWatchPath( path )
	connectBridge()

	if	( fromUrl ) {
		try {
			await loadZuFile( fromUrl, ui )
		} catch ( er ) {
			Report ? Report( er ) : console.error( er )
		}
	} else {
		pushSnapshot()
	}
}
