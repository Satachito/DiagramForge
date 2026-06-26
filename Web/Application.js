export	const
Report = _ => ( console.error( _ ), alert( _ ) )

window.app		= {
	model	: {
		nodes	: []	//	[ ID, S, P ]		(S)hape		, (P)aint
	,	links	: []	//	[ [ F, T ]. A, P ]	A: { headF, headT, anchorF, anchorT }
	}
,	reforms		: []	//	Equal to model.nodes
}

export	const
STORAGE_KEY	= 'tokyo.828.diagramforge'

export	const
JSONString	= () => JSON.stringify( { model: app.model, canvasWidth, canvasHeight }, null, '\t' )

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
let
canvasHeight	= CANVAS_DEFAULT

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

export	const
AvailableLinks	= () => app.model.links.reduce(
	( $, _ ) => {
		const
		[ [ F, T ], A, P ] = _
		const nF = FindNode( F )
		const nT = FindNode( T )
		if	( nF && nT ) $.push( [ [ nF, nT ], A, P ] )
		return $
	}
,	[]
)

import Do from './Jobs.js'


//	Snapshot-based history: capture the state before and after the mutation,
//	then undo/redo simply restore a *clone* of the relevant snapshot. Restoring a
//	clone (never the snapshot object itself) keeps both snapshots pristine, so a
//	later redo can't corrupt the snapshot a subsequent undo relies on.
const
restoreFunc = _ => async () => (
	app = structuredClone( _ )
,	app.reforms = app.reforms.reduce(
		( $, [ ID ] ) => {
			const
			node = FindNode( ID )
			node && $.push( structuredClone( node ) )
			return $

		}
	,	[]
	)
,	MAIN_EDITOR.clearInteraction()
,	await MAIN_EDITOR.Draw()
,	LINK_EDITOR.Sync()
,	localStorage.setItem( STORAGE_KEY, JSONString() )
)

const
DoTypical	= async ( label, mutate ) => {
	const
	before = structuredClone( app )
	await mutate()
	const
	after = structuredClone( app )
	await Do( label, restoreFunc( after ), restoreFunc( before ) )
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
ID_EPOCH	= 176722560000	//	 Since 2026.01.01

//	the id auto-assign would currently hand out ( for placeholder previews )
export	const
PreviewID	= () => String( Date.now() - ID_EPOCH )

const
GenerateID	= async $ => {
	if	( $ && !app.model.nodes.some( _ => _[ 0 ] === $ ) ) return $
	$ = PreviewID()
	while	( app.model.nodes.some( _ => _[ 0 ] === $ ) ) {
		await new Promise( R => setTimeout( R, 1 ) )
		$ = PreviewID()
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

//	rename and restyle an existing node in a single history step: changes its id
//	( oldID → ID, updating every link that references it ) and its shape / paint
export	const
EditNode	= ( oldID, [ ID, S, P ] ) => DoTypical(
	'EditNode'
,	() => {
		const
		node = FindNode( oldID )
		if	( !node ) return
		node[ 0 ] = ID
		node[ 1 ] = S
		node[ 2 ] = P
		ID !== oldID && app.model.links.forEach(
			link => link[ 0 ] = [
				link[ 0 ][ 0 ] === oldID ? ID : link[ 0 ][ 0 ]
			,	link[ 0 ][ 1 ] === oldID ? ID : link[ 0 ][ 1 ]
			]
		)
		app.reforms = [ structuredClone( node ) ]
	}
)

//	remove a node by id ( and every link touching it ). Selection-independent,
//	unlike Delete which acts on app.reforms.
export	const
RemoveNode	= ID => DoTypical(
	'RemoveNode'
,	() => {
		app.model.nodes = app.model.nodes.filter( _ => _[ 0 ] !== ID )
		app.model.links = app.model.links.filter( ( [ [ F, T ] ] ) => F !== ID && T !== ID )
		app.reforms = app.reforms.filter( _ => _[ 0 ] !== ID )
	}
)

//	replace the whole model ( nodes + links ) in one history step
export	const
SetModel	= model => DoTypical(
	'SetModel'
,	() => {
		app.model	= { nodes: model.nodes ?? [], links: model.links ?? [] }
		app.reforms	= []
	}
)

//	move a node to the front ( drawn last → on top ) or back ( drawn first ) of
//	the z-order
export	const
Restack	= ( ID, toFront ) => DoTypical(
	toFront ? 'BringToFront' : 'BringToBack'
,	() => {
		const
		node = FindNode( ID )
		if	( !node ) return
		app.model.nodes = app.model.nodes.filter( _ => _ !== node )
		toFront ? app.model.nodes.push( node ) : app.model.nodes.unshift( node )
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
					_[ 1 ] = structuredClone( A )
				,	_[ 2 ] = structuredClone( P )
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

//	re-point and restyle an existing link in a single history step: changes its
//	endpoints ( oldF/oldT → F/T ) and replaces its attributes / paint
export	const
EditLink	= ( [ oldF, oldT ], [ [ F, T ], A, P ] ) => DoTypical(
	'EditLink'
,	() => {
		const
		link = app.model.links.find( ( [ [ f, t ] ] ) => f === oldF && t === oldT )
		link && (
			link[ 0 ] = [ F, T ]
		,	link[ 1 ] = A
		,	link[ 2 ] = P
		)
	}
)

export	const
RemoveLink	= ( [ F, T ] ) => DoTypical(
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

	{	Array.from( _.items ?? [] ).filter( item => item.type === 'image/png' ).forEach(
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
		Array.from( _.items ?? [] ).filter( item => item.type === 'image/svg+xml' ).forEach(
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

	//	assign ids unique against the model AND within this batch ( concurrent
	//	GenerateID could otherwise hand out the same timestamp id to siblings )
	const
	taken = new Set( app.model.nodes.map( _ => _[ 0 ] ) )
	,	newID = () => {
		let	id = String( Date.now() - 176722560000 )
		while	( taken.has( id ) )	id = String( Number( id ) + 1 )
		taken.add( id )
		return	id
	}
	const $ = nodes.map( _ => [ newID(), ..._ ] )
	void DoTypical(
		'Paste'
	,	() => (
			app.model.nodes.push( ...$ )
		,	app.reforms = structuredClone( $ )
		)
	)
}


const
MARGIN	= 256

import { BBox } from './GeoDF.js'

const
fitCanvas	= px => Math.max( 256, Math.ceil( ( px + MARGIN ) / 256 ) * 256 )

export	const
Load		= _ => DoTypical(
	'Load'
,	() => {
		const
		{ model, canvasWidth, canvasHeight } = JSON.parse( _ )
		app.model	= model
		app.reforms	= []
		if	( canvasWidth > 0 && canvasHeight > 0 ) {
			SetCanvasSize( canvasWidth, canvasHeight )
		} else if ( model.nodes.length ) {
			const
			[ , , b, r ] = BBox( model.nodes )
			SetCanvasSize( fitCanvas( r ), fitCanvas( b ) )
		}
	}
)

