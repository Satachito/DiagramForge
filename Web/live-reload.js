//	Live .cde reload when tools/df-server.mjs detects a file save.
//
//	Watch path comes from ?cde=Samples/JSONs.cde or sessionStorage ( last load ).

import { Load	} from './Application.js'

let
watchPath = null

export const
getWatchPath	= () => watchPath

export const
setWatchPath	= path => {
	watchPath = path
	path && sessionStorage.setItem( 'df-watch', path )
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
}

export const
connectLiveReload	= () => {
	if	( location.protocol !== 'http:' && location.protocol !== 'https:' ) return

	const
	proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
	,	url = `${ proto }//${ location.host }/__df/ws`
	,	connect = () => {
		const
		ws = new WebSocket( url )
		ws.onmessage = async ev => {
			let	msg
			try { msg = JSON.parse( ev.data ) } catch { return }
			if	( msg.type !== 'cde-changed' || !watchPath || msg.path !== watchPath ) return
			try {
				await loadCdeFile( watchPath, window )
			} catch ( er ) {
				console.error( '[live-reload]', er )
			}
		}
		ws.onclose = () => setTimeout( connect, 1500 )
	}
	connect()
}

export const
initLiveReload	= async ( ui, { Report } = {} ) => {
	const
	fromUrl = new URLSearchParams( location.search ).get( 'cde' )
	,	fromStore = sessionStorage.getItem( 'df-watch' )
	,	path = fromUrl || fromStore

	setWatchPath( path )
	connectLiveReload()

	if	( fromUrl ) {
		try {
			await loadCdeFile( fromUrl, ui )
		} catch ( er ) {
			Report ? Report( er ) : console.error( er )
		}
	}
}
