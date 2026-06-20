export	const
Report = alert

export	const
STORAGE_KEY	= 'tokyo.828.diagramforge'

window.app		= {
	model	: {
		nodes	: []	//	[ ID, S, P ]	(S)hape		, (P)aint
	,	links	: []	//	[ [ F, { headF, headT, anchorF, anchorT }, T ], P ]
	}
,	reforms		: []	//	Equal to model.nodes
}

export	const
CANVAS_DEFAULT	= 4096

export	const
CANVAS_STORAGE_KEY	= `${ STORAGE_KEY }.canvas`

const
loadCanvasSize	= () => {
	try {
		const
		[ w, h ] = JSON.parse( localStorage.getItem( CANVAS_STORAGE_KEY ) )
		if	( w > 0 && h > 0 )	return [ w, h ]
	} catch {}
	return [ CANVAS_DEFAULT, CANVAS_DEFAULT ]
}

let
canvasWidth		= CANVAS_DEFAULT
,	canvasHeight	= CANVAS_DEFAULT

;[ canvasWidth, canvasHeight ] = loadCanvasSize()

export	const
CanvasSize		= () => [ canvasWidth, canvasHeight ]

export	const
SetCanvasSize	= ( width, height ) => {
	canvasWidth		= width
	canvasHeight	= height
	localStorage.setItem( CANVAS_STORAGE_KEY, JSON.stringify( [ width, height ] ) )
}

export	const
FindNode		= ID => app.model.nodes.find( _ => _[ 0 ] === ID )

export	const
FindReform		= ID => app.reforms.find( _ => _[ 0 ] === ID )

const
SyncReformsFromModel	= () => {
	app.reforms = app.reforms.flatMap(
		( [ ID ] ) => {
			const
			node = FindNode( ID )
			return node ? [ [ ID, structuredClone( node[ 1 ] ), structuredClone( node[ 2 ] ) ] ] : []
		}
	)
}

import Do from './Jobs.js'
import { Union } from './Geo2D.js'
import { TLBR } from './GeoDF.js'

const
Persist		= () => localStorage.setItem( STORAGE_KEY, JSONString() )

//	Snapshot-based history: capture the state before and after the mutation,
//	then undo/redo simply restore a *clone* of the relevant snapshot. Restoring a
//	clone (never the snapshot object itself) keeps both snapshots pristine, so a
//	later redo can't corrupt the snapshot a subsequent undo relies on.
const
restoreSnapshot	= snapshot => async () => (
	app = structuredClone( snapshot )
,	SyncReformsFromModel()
,	MAIN_EDITOR.clearInteraction()
,	await MAIN_EDITOR.Draw()
,	LINK_EDITOR.Sync()
,	Persist()
)

const
DoTypical	= async ( label, mutate ) => {
	const
	before = structuredClone( app )
	await mutate()
	const
	after = structuredClone( app )
	await Do( label, restoreSnapshot( after ), restoreSnapshot( before ) )
}

export	const
Reform		= () => {
	const
	pendingReforms = structuredClone( app.reforms )
	return	DoTypical(
		'Reform'
	,	() => {
			const
			IDs = pendingReforms.map( _ => _[ 0 ] )

			app.model.nodes = [
				...app.model.nodes.filter( _ => !IDs.includes( _[ 0 ] ) )
			,	...structuredClone( pendingReforms )
			]
		,	app.reforms = structuredClone( pendingReforms )
		}
	)
}

const
GenerateID	= async $ => {
	if	( $ && !app.model.nodes.some( _ => _[ 0 ] === $ ) ) return $
	$ = String( ( new Date() ).getTime() - 176722560000 )	//	 Since 2026.01.01
	while	( app.model.nodes.some( _ => _[ 0 ] === $ ) ) {
		await new Promise( R => setTimeout( R, 1 ) )
		$ = String( ( new Date() ).getTime() - 176722560000 )	//	 Since 2026.01.01
	}
	return $
}

export	const
Node	= ( [ ID, S, P ] ) => DoTypical(
	'ApplyNode'
,	async () => {
		const
		node = FindNode( ID )
		if	( node ) {
			node[ 1 ] = S
			node[ 2 ] = P
			const
			reform = FindReform( ID )
			reform && (
				reform[ 1 ] = structuredClone( S )
			,	reform[ 2 ] = structuredClone( P )
			)
		} else {
			const
			$ = [ ID || await GenerateID(), S, P ]
			app.model.nodes.push( $ )
			app.reforms = [ structuredClone( $ ) ]
		}
	}
)

export	const
Link	= ( [ [ F, T ], A, P ] ) => DoTypical(
	'Link'
,	() => {
		const
		$ = app.model.links.filter( ( [ [ f, t ], a, p ] ) => f === F && t === T )
		$.length
		?	$.forEach(
				_ => (
					_[ 1 ] = A
				,	_[ 2 ] = P
				)
			)
		:	(	app.model.links.push( [ [ F, T ], A, P ] )
			,	app.reforms = [
					structuredClone( FindNode( F ) )
				,	structuredClone( FindNode( T ) )
				] 
			)
	}
)

export	const
RemoveLink	= ( F, T ) => DoTypical(
	'RemoveLink'
,	() => (
		app.model.links = app.model.links.filter(
			( [ [ f, t ], a, p ] ) => f !== F || t !== T
		)
	,	app.reforms = []
	)
)

export	const
Delete		= () => DoTypical(
	'Delete'
,	() => (
		app.model.nodes = app.model.nodes.filter(
			node => !FindReform( node[ 0 ] )
		)
	,	app.model.links = app.model.links.filter(
			( [ [ F, T ], A, P ] ) => !FindReform( F ) && !FindReform( T )
		)
	,	app.reforms = []
	)
)

export	const
Copy		= _ => _.setData(	//	ClipboardData
	'application/x-diagramforge-828-tokyo'
,	JSON.stringify( app.reforms.map( ( [ ID, S, P ] ) => [ S, P ] ) )
)

export	const
Paste		= async _ => {	//	ClipboardData

	const
	nodes = []

	{	const
		json = _.getData( 'application/x-diagramforge-828-tokyo' )
		if	( json ) try {
			nodes.push( ...JSON.parse( json ) )
		} catch ( er ) {
			console.error( er )
		}
	}

	{	_.items.filter( item => item.type === 'image/png' ).forEach(
			async item => {
				try {
					const blob = item.getAsFile()
					const bitmap = await createImageBitmap( blob )
					const W = bitmap.width
					const H = bitmap.height
					bitmap.close()

					nodes.push(
						[	{	type	: 'PNG'
							,	cX		: W / 2
							,	cY		: H / 2
							,	rH		: W / 2
							,	rV		: H / 2
							,	PNG		: btoa( String.fromCharCode( ...new Uint8Array( await blob.arrayBuffer() ) ) )
							}
						,	{}
						]
					)
				} catch ( er ) {
					console.error( er )
				}
			}
		)
	}

	{	const
		LoadImage = url => new Promise(
			( S, J ) => {
				const $ = new Image()
				$.onload = () => (
					S( $ )
				,	URL.revokeObjectURL( url )
				)
				$.onerror = () => (
					URL.revokeObjectURL( url )
				,	J( new Error( 'SVG load failed' ) ) 
				)
				$.src = url
			}
		)
		_.items.filter( item => item.type === 'image/svg+xml' ).forEach(
			async item => {
				try {
					const SVG = item.kind === 'string'
					?	await new Promise( S => item.getAsString( s => S( s ) ) )
					:	await item.getAsFile().text()
					const image = await LoadImage( URL.createObjectURL( new Blob( [ SVG ], { type: 'image/svg+xml;charset=utf-8' } ) ) )
					const [ W, H ] = [ image.naturalWidth, image.naturalHeight ]
					nodes.push(
						[	{	type	: 'SVG'
							,	cX		: W / 2
							,	cY		: H / 2
							,	rH		: W / 2
							,	rV		: H / 2
							,	SVG
							}
						,	{}
						]
					)
				} catch ( er ) {
					console.error( er )
				}
			}
		)
	}

	const $ = await Promise.all( nodes.map( async _ => [ await GenerateID(), ..._ ] ) )
	void DoTypical(
		'Paste'
	,	() => (
			app.model.nodes.push( ...$ )
		,	app.reforms = structuredClone( $ )
		)
	)
}

export	const
JSONString	= () => JSON.stringify( { ...app.model, canvasWidth, canvasHeight }, null, '\t' )

const
MARGIN	= 256

export	const		//	THROWS EXCEPTION
Load		= _ => DoTypical(
	'Load'
,	() => {
		const
		$ = JSON.parse( _ )
		app.model.nodes	= $.nodes
		app.model.links	= $.links
		app.reforms		= []
		if	( $.canvasWidth > 0 && $.canvasHeight > 0 ) {
			SetCanvasSize( $.canvasWidth, $.canvasHeight )
		} else if ( $.nodes.length ) {
			const	[ t, l, b, r ] = Union( $.nodes.map( n => TLBR( n[ 1 ] ) ) )
			const	cw = Math.ceil( ( r + MARGIN ) / 256 ) * 256
			const	ch = Math.ceil( ( b + MARGIN ) / 256 ) * 256
			SetCanvasSize( Math.max( 256, cw ), Math.max( 256, ch ) )
		}
	}
)

