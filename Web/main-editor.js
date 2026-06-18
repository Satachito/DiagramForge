import {
	Report
,	FindNode
,	FindReform
,	Reform
,	Node
,	Link
,	RemoveLink
,	Delete
,	Copy
,	Paste
,	CanvasSize
}	from './Application.js'

import {
	Redo
,	Undo
}	from './Jobs.js'

import {
	AE
}	from './DomUtils.js'

import {
	XYWH
,	TLBR
,	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsTLBR
,	Union
}	from './geo2D.js'

import {
	BBox
,	RectPath2D
,	EllipsePath2D
,	RhombusPath2D
,	LinkPath2D
,	GRAB
,	UnselectedAt
,	SelectedMemberAt
,	SelectionGrabAt
,	SelectionInteriorAt
,	NodeInterior
,	SelectionGrabCursor
,	Node_XY
}	from './geoDF.js'

import { DrawForeignLabel	} from './ForeignLabel.js'
import { DrawLinkCanvas	} from './DrawLink.js'

const
copyText		= text => navigator.clipboard.writeText( text ).catch( Report )

const
mouse			= [ null, null ]

let
mouseDrag		= null	//	'move' | 'resize'

const
XYWH_XYXY		= ( [ [ x, y ], [ X, Y ] ] ) => [ x, y, X - x, Y - y ]

const
XY_EV			= ev => [ ev.offsetX, ev.offsetY ]
const
AddXY			= ( [ X, Y ], [ x, y ] )	=> [ X + x, Y + y ]
const
DivXY			= ( [ X, Y ], _ )			=> [ X / _, Y / _ ]
const
EqualXY			= ( [ X, Y ], [ x, y ] )	=> X === x && Y === y
const
DeltaXY			= ( [ X, Y ], [ x, y ] )	=> [ x - X, y - Y ]

const
DrawPath		= ( c2D, path, P ) => {
	c2D.save()
	const	fill	= P[ 'fill'	]
	if	( fill ) {
		c2D.fillStyle = fill
		c2D.fill( path )
	}
	const	stroke	= P[ 'stroke' ]
	if	( stroke ) {
		const	lineWidth		= P[ 'lineWidth'		]; lineWidth		&& ( c2D.lineWidth		= lineWidth			)
		const	lineCap			= P[ 'lineCap'			]; lineCap			&& ( c2D.lineCap		= lineCap			)
		const	lineJoin		= P[ 'lineJoin'			]; lineJoin			&& ( c2D.lineJoin		= lineJoin			)
		const	lineDash		= P[ 'lineDash'			]; c2D.setLineDash( lineDash?.length ? lineDash : [] )
		const	lineDashOffset	= P[ 'lineDashOffset'	]; lineDashOffset	&& ( c2D.lineDashOffset	= lineDashOffset	)
		const	miterLimit		= P[ 'miterLimit'		]; miterLimit		&& ( c2D.miterLimit		= miterLimit		)
		c2D.strokeStyle = stroke
		c2D.stroke( path )
	}
	c2D.restore()
}

const
UpdateHoverLabel = ev => {
	const
	node = Node_XY( XY_EV( ev ) )
	if ( !node ) {
		UNDER_HOVER.style.display = 'none'
		return
	}
	UNDER_HOVER.textContent		= node[ 0 ]
	UNDER_HOVER.style.display	= 'block'
	UNDER_HOVER.style.left		= `${ ev.clientX + 12 }px`
	UNDER_HOVER.style.top		= `${ Math.max( 8, ev.clientY - 28 ) }px`
}


export default class
MainEditor extends HTMLElement {

	Draw() {
		this.ApplyCanvasSize()
		window.EMPTY_HINT && ( window.EMPTY_HINT.style.display = app.model.nodes.length ? 'none' : '' )
		return Promise.all( [ this.DrawNodes(), this.DrawReforms() ] ).catch( Report )
	}

	clearInteraction() {
		mouse[ 0 ] = mouse[ 1 ] = null
		mouseDrag = null
	}

	ApplyCanvasSize() {
		const
		[ w, h ] = CanvasSize()
		if	( !( w > 0 && h > 0 ) )	throw new Error( `Invalid canvas size: ${ w }×${ h }` )
		this.drawer.width		= this.reformer.width		= w
		this.drawer.height		= this.reformer.height		= h
	}

	async DrawNodes() {
		const	c2D = this.drawer.getContext( '2d' )

		const
		drawSVG		= async ( svg, S ) => {
			//	SVG must go through <img>: createImageBitmap() rejects SVG blobs
			//	in Chrome ("The source image could not be decoded").
			const
			url = URL.createObjectURL( new Blob( svg, { type: 'image/svg+xml;charset=utf-8' } ) )
			try {
				const
				image = new Image()
				image.src = url
				image.decode ? await image.decode() : await new Promise(
					( Res, Rej ) => (
						image.onload	= () => Res()
					,	image.onerror	= () => Rej( new Error( 'SVG: loading failed' ) )
					)
				)
				c2D.drawImage( image, ...XYWH( S ) )
			} finally {
				URL.revokeObjectURL( url )
			}
		}

		c2D.clearRect( 0, 0, this.drawer.width, this.drawer.height )

		for ( const [ ID, S, P ] of app.model.nodes ) {
			try {
				switch ( S.type ) {
				case 'rect':
					DrawPath( c2D, RectPath2D( S ), P )
					break
				case 'ellipse':
					DrawPath( c2D, EllipsePath2D( S ), P )
					break
				case 'rhombus':
					DrawPath( c2D, RhombusPath2D( S ), P )
					break
				case 'SVG':
					await drawSVG(
						[ Uint8Array.from( atob( S.SVG ), ch => ch.charCodeAt( 0 ) ) ]
					,	S
					)
					break
				case 'PNG':
					c2D.drawImage(
						await createImageBitmap(
							new Blob(
								[ Uint8Array.from( atob( S.PNG ), _ => _.charCodeAt( 0 ) ) ]
							,	{ type: 'image/png' }
							)
						)
					,	...XYWH( S )
					)
					break
				default:
					console.log( 'Unknown:', S.type )
					break
				}
				if	( S.html )	await DrawForeignLabel( drawSVG, S )
			} catch ( er ) {
				console.error( 'DrawNodes failed:', ID, er )
			}
		}

		//	guard: FindNode may return undefined if a link references a deleted node
		app.model.links.forEach(
			( [ [ F, A, T ], P ] ) => {
				const	nF = FindNode( F )
				const	nT = FindNode( T )
				nF && nT && DrawLinkCanvas(
					c2D, nF[ 1 ], A, nT[ 1 ], P, { paintF: nF[ 2 ], paintT: nT[ 2 ] }
				)
			}
		)
	}

	async DrawReforms() {
		const	c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		for ( const [ [ F, A, T ], S ] of app.model.links ) {
			const	rF = FindReform( F )
			const	rT = FindReform( T )
			rF && rT && DrawLinkCanvas(
				c2D, rF[ 1 ], A, rT[ 1 ], S, { paintF: rF[ 2 ], paintT: rT[ 2 ] }
			)
		}

		if	( app.reforms.length ) {
			c2D.save()
			c2D.strokeStyle = '#00ffff'
			c2D.lineWidth = 4
			for ( const [ , S ] of app.reforms ) c2D.strokeRect( ...XYWH( S ) )
			c2D.strokeStyle = '#ff0000'
			c2D.lineWidth = 2
			const	[ hT, hL, hB, hR ] = BBox( app.reforms )
			c2D.strokeRect( ...XYWH_TLBR( [ hT, hL, hB, hR ] ) )
			//	resize handles: 4 corners + 4 edge midpoints
			const	hMX = ( hL + hR ) / 2, hMY = ( hT + hB ) / 2, HS = 8
			c2D.fillStyle = '#ffffff'
			c2D.lineWidth = 1.5
			for ( const [ hx, hy ] of [
				[ hL, hT ], [ hMX, hT ], [ hR, hT ]
			,	[ hL, hMY ],              [ hR, hMY ]
			,	[ hL, hB ], [ hMX, hB ], [ hR, hB ]
			] ) {
				c2D.fillRect( hx - HS / 2, hy - HS / 2, HS, HS )
				c2D.strokeRect( hx - HS / 2, hy - HS / 2, HS, HS )
			}
			c2D.restore()
		} else {
			mouse[ 0 ] && mouse[ 1 ] && (
				c2D.save()
			,	c2D.strokeStyle = '#888888'
			,	c2D.lineWidth = 2
			,	c2D.strokeRect( ...XYWH_XYXY( mouse ) )
			,	c2D.restore()
			)
		}
	}

	constructor() {
		super()

		this.style.position			= 'relative'

		this.drawer					= AE( this, 'canvas' )
		this.reformer				= AE( this, 'canvas' )
		this.drawer.style.position	= this.reformer.style.position	= 'absolute'
		this.linkMenuKey			= null
		this.nodeMenuTarget			= null

		LINK_MENU_REMOVE.onclick	= ev => (
			ev.stopPropagation()
		,	this.linkMenuKey && RemoveLink( this.linkMenuKey[ 0 ], this.linkMenuKey[ 2 ] )
		,	this.hideContextMenus()
		,	this.reformer.focus()
		)

		NODE_MENU_DELETE.onclick	= async ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && await Delete()
		,	this.hideContextMenus()
		,	this.reformer.focus()
		)

		NODE_MENU_COPY_ID.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 0 ] )
		,	this.hideContextMenus()
		)

		NODE_MENU_COPY_HTML.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 1 ].html ?? '' )
		,	this.hideContextMenus()
		)

		NODE_MENU_COPY_STYLE.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 1 ].style ?? '' )
		,	this.hideContextMenus()
		)

		//	window-level: catches clicks outside main-editor too
		//	capture(true): runs before stopPropagation() in menu onclick handlers
		addEventListener( 'pointerdown', ev => {
			if	( LINK_MENU.style.display === 'none' && NODE_MENU.style.display === 'none' ) return
			if	( LINK_MENU.contains( ev.target ) || NODE_MENU.contains( ev.target ) ) return
			this.hideContextMenus()
		}, true )

		this.reformer.oncontextmenu	= ev => this.onContextMenu( ev )
		this.reformer.oncopy		= ev => ( ev.preventDefault(), Copy( ev.clipboardData ) )
		this.reformer.oncut			= ev => ( this.reformer.oncopy( ev ), Delete() )
		this.reformer.onpaste		= ev => ( ev.preventDefault(), Paste( ev.clipboardData ) )

		//	window-level so shortcuts work without the canvas being focused
		addEventListener( 'keydown', ev => this.onKeyDown( ev ) )
		//	⌘/⌥ momentarily act as Create-node / Create-link; refresh cursor on release
		addEventListener( 'keyup', ev => this.refreshModeCursor( ev ) )
		CREATE_NODE.onchange = CREATE_LINK.onchange = () => this.refreshModeCursor()

		this.reformer.onmouseleave	= () => (
			UNDER_HOVER.style.display = 'none'
		,	mouse[ 0 ] = null
		,	mouse[ 1 ] = null
		)
		this.reformer.onmousedown	= ev => this.onMouseDown( ev )
		this.reformer.onmousemove	= ev => this.onMouseMove( ev )
		this.reformer.onmouseup		= ev => this.onMouseUp( ev )

		matchMedia( '(prefers-color-scheme: dark)' ).addEventListener(
			'change'
		,	() => this.Draw()
		)
	}

	hideContextMenus() {
		LINK_MENU.style.display	= 'none'
		NODE_MENU.style.display	= 'none'
		this.linkMenuKey		= null
		this.nodeMenuTarget		= null
	}

	positionContextMenu( menu, ev ) {
		const	pad	= 8
		const	w	= menu.offsetWidth	|| 120
		const	h	= menu.offsetHeight	|| 40
		menu.style.left	= `${ Math.max( pad, Math.min( ev.clientX, innerWidth - w - pad ) ) }px`
		menu.style.top	= `${ Math.max( pad, Math.min( ev.clientY, innerHeight - h - pad ) ) }px`
	}

	//	the two toggles, each temporarily forced on by a modifier key
	nodeMode( ev ) { return CREATE_NODE.checked || !!( ev && ev.metaKey ) }	//	create node / select area
	linkMode( ev ) { return CREATE_LINK.checked || !!( ev && ev.altKey ) }	//	create link / select node

	//	coarse cursor for the current mode ( refined per-position by cursorAt on move )
	refreshModeCursor( ev ) {
		this.reformer.style.cursor = ( this.nodeMode( ev ) || this.linkMode( ev ) ) ? 'crosshair' : 'default'
	}

	async onKeyDown( ev ) {
		this.refreshModeCursor( ev )
		const	t = ev.target
		if	( t && ( /^(INPUT|TEXTAREA|SELECT)$/.test( t.tagName ) || t.isContentEditable ) ) return
		switch ( ev.key ) {
		case 'z':	case 'Z':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await ( ev.shiftKey ? Redo() : Undo() ) }
			break
		case 'y':	case 'Y':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await Redo() }
			break
		case 'a':	case 'A':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await this.selectAll() }
			break
		case 'e':	case 'E':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await this.expand() }
			break
		case 'Escape':
			mouse[ 0 ] = mouse[ 1 ] = null
			mouseDrag = null
			this.hideContextMenus()
			await this.DrawReforms()
			break
		case 'Delete':
		case 'Backspace':
			ev.preventDefault()
			await Delete()
			break
		default:
			break
		}
	}

	cursorAt( ev ) {
		const	xy = XY_EV( ev )
		//	acting on the existing selection
		if	( app.reforms.length ) {
			if	( SelectionGrabAt( xy ) )		return SelectionGrabCursor( BBox( app.reforms ), xy )
			if	( SelectionInteriorAt( xy ) )	return 'move'
		}
		//	over a link line → a click selects its endpoints
		if	( this.linkEndpointsAt( xy ) )		return 'pointer'
		//	over a node
		const
		node = UnselectedAt( xy )
		if	( node ) {
			if	( this.linkMode( ev ) )			return 'crosshair'	//	would start a link
			return NodeInterior( TLBR( node[ 1 ] ), xy )
			?	'move'											//	select + move
			:	SelectionGrabCursor( TLBR( node[ 1 ] ), xy )	//	select + resize
		}
		//	empty canvas
		return this.nodeMode( ev ) ? 'crosshair' : 'default'
	}

	//	add a node (clone) to the selection if not already present
	registReform( _ ) {
		return FindReform( _[ 0 ] ) || app.reforms.push( structuredClone( _ ) )
	}

	//	move every selected node to the end of the draw order (front)
	rollSelectedToTop() {
		app.model.nodes.forEach(
			$ => app.reforms.find( _ => _[ 0 ] === $[ 0 ] ) && (
				app.model.nodes = app.model.nodes.filter( _ => _ !== $ )
			,	app.model.nodes.push( $ )
			)
		)
	}

	async selectAll() {
		app.reforms = app.model.nodes.map( _ => structuredClone( _ ) )
		await this.DrawReforms()
	}

	//	plain click: select just the one node, replacing any selection
	async selectSingle( node ) {
		NODE_ID.value		= node[ 0 ]
		SHAPE_EDITOR.$		= node[ 1 ]
		PAINT_EDITOR.$		= node[ 2 ]
		this.registReform( node )
		this.rollSelectedToTop()
		await this.DrawReforms()
	}

	//	shift+click: extend the selection with the node and everything it contains
	async addWithContained( node ) {
		NODE_ID.value		= node[ 0 ]
		SHAPE_EDITOR.$		= node[ 1 ]
		PAINT_EDITOR.$		= node[ 2 ]
		const
		tlbr = TLBR( node[ 1 ] )
		this.registReform( node )
		app.model.nodes.forEach(
			_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
		)
		this.rollSelectedToTop()
		await this.DrawReforms()
	}

	//	⌘E: expand the current selection to include everything it contains
	//	(a node with nothing inside it simply stays as-is). Selection only,
	//	so it is not part of the undo history.
	async expand() {
		if	( !app.reforms.length ) return
		app.reforms.slice().forEach(
			reform => {
				const
				node = FindNode( reform[ 0 ] )
				if	( !node ) return
				const
				tlbr = TLBR( node[ 1 ] )
				app.model.nodes.forEach(
					_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
				)
			}
		)
		this.rollSelectedToTop()
		await this.DrawReforms()
	}

	//	link hit-test → [ nodeF, nodeT, [ F, A, T ] ] or null
	linkEndpointsAt( xy ) {
		let	$ = null
		app.model.links.forEach(
			( [ [ F, A, T ], P ] ) => {
				const
				[ nF, nT ]	= [ FindNode( F ), FindNode( T ) ]
				nF && nT && this.reformer.getContext( '2d' ).isPointInPath(
					LinkPath2D( nF[ 1 ], A, nT[ 1 ], { paintF: nF[ 2 ], paintT: nT[ 2 ] } )
				,	...xy
				) && (
					$ = [ nF, nT, [ F, A, T ] ]
				)
			}
		)
		return	$
	}

	registLink( link ) {
		this.registReform( link[ 0 ] )
		this.registReform( link[ 1 ] )
		LINK_EDITOR.$ = link[ 2 ]
	}

	findLinkKeyAt( xy ) {
		const
		c2D = this.reformer.getContext( '2d' )
		for	( let i = app.model.links.length; i--; ) {
			const	[ [ F, A, T ], P ] = app.model.links[ i ]
			const	nF		= FindNode( F )
			const	nT		= FindNode( T )
			if	( ! nF || ! nT ) continue
			const	path	= LinkPath2D( nF[ 1 ], A, nT[ 1 ], { paintF: nF[ 2 ], paintT: nT[ 2 ] } )
			c2D.lineWidth	= Math.max( Number( P.lineWidth || 4 ), 10 )
			c2D.lineCap		= P.lineCap		|| 'butt'
			c2D.lineJoin	= P.lineJoin	|| 'miter'
			if	( P.stroke	&& c2D.isPointInStroke( path, ...xy ) )	return [ F, A, T ]
			if	( P.fill	&& c2D.isPointInFill( path, ...xy ) )	return [ F, A, T ]
		}
		return null
	}

	async onContextMenu( ev ) {
		const
		xy = XY_EV( ev )
		const
		key = this.findLinkKeyAt( xy )
		if	( key ) {
			ev.preventDefault()
			this.hideContextMenus()
			this.linkMenuKey	= key
			LINK_MENU.style.display	= 'block'
			this.positionContextMenu( LINK_MENU, ev )
			return
		}
		const
		node = Node_XY( xy )
		if	( ! node ) return
		ev.preventDefault()
		this.hideContextMenus()
		app.reforms			= []
		await this.selectSingle( node )
		this.nodeMenuTarget		= node
		NODE_MENU.style.display	= 'block'
		this.positionContextMenu( NODE_MENU, ev )
	}

	async onMouseDown( ev ) {
		this.reformer.tabIndex = 0

		if	( ev.button ) return

		const
		xy	= mouse[ 0 ] = XY_EV( ev )

		//	Shift+click extends the selection: add the node under the cursor plus
		//	everything it contains (or a link's two endpoints), keeping the rest.
		if	( ev.shiftKey ) {
			mouseDrag = 'move'
			const
			node = UnselectedAt( xy ) || SelectedMemberAt( xy )
			if	( node ) {
				await this.addWithContained( node )
			} else {
				const	link = this.linkEndpointsAt( xy )
				link && this.registLink( link )
				await this.DrawReforms()
			}
			return
		}

		//	1. act on the current selection: resize the edge, move the interior,
		//	   or ( clicked outside ) drop it and carry on
		if	( app.reforms.length ) {
			if	( SelectionGrabAt( xy ) )		{ mouseDrag = 'resize'; return }
			if	( SelectionInteriorAt( xy ) )	{ mouseDrag = 'move'; await this.DrawReforms(); return }
			app.reforms = []
			await this.DrawReforms()
		}

		//	2. a click on a link selects its two endpoints
		const
		link = this.linkEndpointsAt( xy )
		if	( link ) {
			mouseDrag = 'move'
			this.registLink( link )
			await this.DrawReforms()
			return
		}

		//	3. a node under the cursor: start a link from it ( link mode ),
		//	   else select it and move / resize
		const
		node = UnselectedAt( xy )
		if	( node ) {
			if	( this.linkMode( ev ) ) { mouseDrag = 'link'; return }
			await this.selectSingle( node )
			mouseDrag = NodeInterior( TLBR( node[ 1 ] ), xy ) ? 'move' : 'resize'
			return
		}

		//	4. empty canvas: drag creates a node ( node mode ) or selects an area
		mouseDrag = this.nodeMode( ev ) ? 'create' : 'area'
	}

	async onMouseMove( ev ) {

		UpdateHoverLabel( ev )

		if	( mouse[ 0 ] === null ) {
			this.reformer.style.cursor = this.cursorAt( ev )
			return
		}
		//	mouseleave may be missed on fast movement — reset if button already released
		if	( !ev.buttons ) {
			mouse[ 0 ] = mouse[ 1 ] = null
			mouseDrag = null
			return
		}

		const
		c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		mouse[ 1 ] = [ ev.offsetX, ev.offsetY ]
		if	( EqualXY( mouse[ 0 ], mouse[ 1 ] ) ) return

		const
		paint = PAINT_EDITOR.$

		switch	( mouseDrag ) {
		case 'link':
			c2D.save()
			c2D.strokeStyle = paint.stroke || 'dodgerblue'
			c2D.lineWidth = Number( paint.lineWidth || 2 )
			c2D.lineCap = paint.lineCap || 'butt'
			c2D.beginPath()
			c2D.moveTo( ...mouse[ 0 ] )
			c2D.lineTo( ...mouse[ 1 ] )
			c2D.stroke()
			c2D.restore()
			return
		case 'create':
			c2D.save()
			c2D.strokeStyle = paint.stroke || 'dodgerblue'
			c2D.lineWidth = Number( paint.lineWidth || 2 )
			c2D.lineCap = paint.lineCap || 'butt'
			c2D.strokeRect( ...XYWH_XYXY( mouse ) )
			c2D.restore()
			return
		case 'area':
			c2D.save()
			c2D.strokeStyle = 'lightgray'
			c2D.strokeRect( ...XYWH_XYXY( mouse ) )
			c2D.restore()
			return
		case 'resize':
			{	let		edgeMode = false

				const	tlbr = BBox( app.reforms.map( _ => FindNode( _[ 0 ] ) ) )
				const	edgeDist = EdgeDist( tlbr, mouse[ 0 ] )
				const	[ t, l, b, r ] = tlbr
				const	T = edgeDist[ 0 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 1 ] ) : t
				const	L = edgeDist[ 1 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 0 ] ) : l
				const	B = edgeDist[ 2 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 1 ] ) : b
				const	R = edgeDist[ 3 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 0 ] ) : r

				if	( edgeMode ) {
					const	scaleX	= ( R - L ) / ( r - l || 1 )
					const	scaleY	= ( B - T ) / ( b - t || 1 )
					const	tX = L - l * scaleX
					const	tY = T - t * scaleY

					app.reforms.forEach(
						( [ ID, S ] ) => {
							const	[ t, l, b, r ] = TLBR( FindNode( ID )[ 1 ] )
							const	T = t * scaleY + tY
							const	L = l * scaleX + tX
							const	B = b * scaleY + tY
							const	R = r * scaleX + tX
							S.cX = ( L + R ) / 2
							S.cY = ( T + B ) / 2
							S.rH = ( R - L ) / 2
							S.rV = ( B - T ) / 2
						}
					)
				}
			}
			await this.DrawReforms()
			return
		case 'move':
			{	const	[ dX, dY ] = DeltaXY( ...mouse )
				app.reforms.forEach(
					( [ ID, S ] ) => {
						const	s = FindNode( ID )[ 1 ]
						S.cX = s.cX + dX
						S.cY = s.cY + dY
					}
				)
			}
			await this.DrawReforms()
			return
		}
	}

	async onMouseUp( ev ) {
		void ev
		const
		[ mouseD, mouseU ] = mouse
		,	drag = mouseDrag
		mouse[ 0 ] = mouse[ 1 ] = null
		mouseDrag = null
		if	( mouseD === null || mouseU === null ) return
		if	( EqualXY( mouseD, mouseU ) ) return

		const
		c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		switch	( drag ) {
		case 'link':
			{	const	F = Node_XY( mouseD );	if	( F === null ) return
				const	T = Node_XY( mouseU );	if	( T === null ) return
				const	[ _F, A, _T ] = LINK_EDITOR.$
				const	$ = [ [ F[ 0 ], A, T[ 0 ] ], PAINT_EDITOR.$ ]
				await Link( $ )
			}
			return
		case 'create':
			{	const	S = SHAPE_EDITOR.$
				const	r = DivXY( DeltaXY( mouseD, mouseU ), 2 )
				const	c = AddXY( mouseD, r )
				S.cX = c[ 0 ]
				S.cY = c[ 1 ]
				S.rH = r[ 0 ]
				S.rV = r[ 1 ]
				await Node( [ NODE_ID.value, S, PAINT_EDITOR.$ ] )
			}
			return
		case 'resize':
		case 'move':
			await Reform()
			return
		case 'area':
			{	const
				tlbr = TLBR_XYXY( [ mouseD, mouseU ] )
				app.model.nodes.forEach(
					_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
				)
				await this.DrawReforms()
			}
			return
		}
	}
}

customElements.define( 'main-editor', MainEditor )
