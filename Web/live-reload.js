//	Live .zu reload + WebSocket RPC bridge to window.DF ( tools/zu-server.mjs ).

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
	path && sessionStorage.setItem( 'df-watch', path )
}

const
snapshot	= () => {
	const
	[ width, height ] = CanvasSize()
	return	{
		model			: window.DF.getModel()
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
	DF = window.DF
	switch ( method ) {
	case 'getModel':
		return	snapshot()
	case 'apply':
		return	DF.apply( params.ops )
	case 'validate':
		return	DF.validate( params.model )
	case 'autoLayout':
		return	DF.autoLayout( params )
	case 'setModel':
		return	DF.setModel( params.model )
	case 'loadCde':
		await loadCdeFile( params.path, uiRef ?? {} )
		return	snapshot()
	default: {
		const	fn = DF[ method ]
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
loadCdeFile	= async ( path, { SyncCanvasInputs, FILE_NAME } = {} ) => {
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
	,	url = `${ proto }//${ location.host }/__df/ws`
	,	connect = () => {
		ws = new WebSocket( url )
		ws.onopen = () => {
			ws.send( JSON.stringify( { type: 'editor-ready', ...snapshot() } ) )
		}
		ws.onmessage = async ev => {
			let	msg
			try { msg = JSON.parse( ev.data ) } catch { return }
			if	( msg.type === 'zu-changed' ) {
				if	( !watchPath || msg.path !== watchPath ) return
				try {
					await loadCdeFile( watchPath, uiRef ?? {} )
				} catch ( er ) {
					console.error( '[live-reload]', er )
				}
				return
			}
			if	( msg.type === 'rpc' ) handleRpc( msg )
		}
		ws.onclose = () => setTimeout( connect, 1500 )
	}
	connect()
}

export const
initLiveReload	= async ( ui, { Report } = {} ) => {
	uiRef = ui
	const
	fromUrl = new URLSearchParams( location.search ).get( 'zu' )
	,	fromStore = sessionStorage.getItem( 'df-watch' )
	,	path = fromUrl || fromStore

	setWatchPath( path )
	connectBridge()

	if	( fromUrl ) {
		try {
			await loadCdeFile( fromUrl, ui )
		} catch ( er ) {
			Report ? Report( er ) : console.error( er )
		}
	} else {
		pushSnapshot()
	}
}
