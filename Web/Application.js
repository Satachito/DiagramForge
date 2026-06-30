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
STORAGE_KEY	= 'tokyo.828.zukai'

export	const
JSONString	= () => JSON.stringify( { model: app.model }, null, '\t' )

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

const
RestoreApp	= _ => async () => (
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
	try {
		await mutate()
	} catch ( er ) {
		await RestoreApp( before )()
		throw er
	}
	const
	after = structuredClone( app )
	await Do( label, RestoreApp( after ), RestoreApp( before ) )
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

export	const
PreviewID	= async $ => {
	if	( $ && !app.model.nodes.some( _ => _[ 0 ] === $ ) ) return $
	$ = String( Date.now() )
	while	( app.model.nodes.some( _ => _[ 0 ] === $ ) ) {
		await new Promise( R => setTimeout( R, 1 ) )
		$ = String( Date.now() )
	}
	return $
}

export	const
Node	= ( [ ID, S, P ] ) => DoTypical(
	'ApplyNode'
,	() => {
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
			$ = [ ID, S, P ]
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
	'application/x-zukai-828-tokyo'
,	JSON.stringify( app.reforms.map( node => structuredClone( node ) ) )
)

export	const
Paste		= async _ => {	//	ClipboardData

	const
	nodes = []
	,	items = Array.from( _.items ?? [] )
	,	bytesToBase64 = bytes => {
		let
		binary = ''
		for	( let i = 0; i < bytes.length; i += 0x8000 ) {
			binary += String.fromCharCode( ...bytes.subarray( i, i + 0x8000 ) )
		}
		return	btoa( binary )
	}

	{	const
		json = _.getData( 'application/x-zukai-828-tokyo' )
		if	( json ) try {
			nodes.push( ...JSON.parse( json ) )
		} catch ( er ) {
			console.error( er )
		}
	}

	{	const
		pngs = await Promise.all(
			items.filter( item => item.type === 'image/png' ).map(
				async item => {
					const blob = item.getAsFile()
					const bitmap = await createImageBitmap( blob )
					const W = bitmap.width
					const H = bitmap.height
					bitmap.close()

					return	[
						{	type	: 'PNG'
						,	cX		: W / 2
						,	cY		: H / 2
						,	rH		: W / 2
						,	rV		: H / 2
						,	PNG		: bytesToBase64( new Uint8Array( await blob.arrayBuffer() ) )
						}
					,	{}
					]
				}
			)
		).catch( er => ( console.error( er ), [] ) )
		nodes.push( ...pngs )
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
		const
		svgs = await Promise.all(
			items.filter( item => item.type === 'image/svg+xml' ).map(
				async item => {
					const SVG = item.kind === 'string'
					?	await new Promise( S => item.getAsString( s => S( s ) ) )
					:	await item.getAsFile().text()
					const image = await LoadImage( URL.createObjectURL( new Blob( [ SVG ], { type: 'image/svg+xml;charset=utf-8' } ) ) )
					const [ W, H ] = [ image.naturalWidth, image.naturalHeight ]
					return	[
						{	type	: 'SVG'
						,	cX		: W / 2
						,	cY		: H / 2
						,	rH		: W / 2
						,	rV		: H / 2
						,	SVG
						}
					,	{}
					]
				}
			)
		).catch( er => ( console.error( er ), [] ) )
		nodes.push( ...svgs )
	}

	if	( !nodes.length ) return

	//	keep original IDs when free; on conflict use orig + "-copy" ( then "-copy2", … )
	const
	taken = new Set( app.model.nodes.map( _ => _[ 0 ] ) )
,	newID = async () => {
		let	id = await PreviewID()
		while	( taken.has( id ) ) {
			id = String( Number( id ) + 1 )
		}
		taken.add( id )
		return	id
	}
,	idFor = orig => {
		if	( !taken.has( orig ) ) {
			taken.add( orig )
			return	orig
		}
		let
		id = `${ orig }-copy`
		,	n = 2
		while	( taken.has( id ) )	id = `${ orig }-copy${ n++ }`
		taken.add( id )
		return	id
	}
	,	$ = []
	for	( const entry of nodes ) {
		const
		orig = typeof entry[ 0 ] === 'string' && entry[ 1 ]?.type ? entry[ 0 ] : null
		$.push( orig
			?	[ idFor( orig ), entry[ 1 ], entry[ 2 ] ?? {} ]
			:	[ await newID(), ...entry ]
		)
	}
	await DoTypical(
		'Paste'
	,	() => (
			app.model.nodes.push( ...$ )
		,	app.reforms = structuredClone( $ )
		)
	)
}

import { BBox } from './GeoZU.js'

export	const
Load		= _ => DoTypical(
	'Load'
,	() => {
		const
		{ model } = JSON.parse( _ )
		if	( !model || !Array.isArray( model.nodes ) || !Array.isArray( model.links ) ) {
			throw new Error( '.zu root must include model.nodes and model.links arrays' )
		}
		const
		canvasSize = model.nodes.length ? BBox( model.nodes ) : null
		app.model	= model
		app.reforms	= []
		if	( canvasSize ) {
			const
			[ , , b, r ] = canvasSize
			MAIN_EDITOR.setCanvasSize( r + 256 , b + 256 )
		}
	}
)
