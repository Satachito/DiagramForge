import {
	AE
}	from './DomUtils.js'

import {
	Report
,	FindNode
,	FindReform
,	AvailableLinks
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
	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsXY
,	ContainsTLBR
,	AreaTLBR
,	XYWH_XYXY
,	XY_EV
,	AddXY
,	DivXY
,	EqualXY
,	DeltaXY
,	Outset
}	from './Geo2D.js'

import {
	XYWH
,	TLBR
,	BBox
,	RectPath2D
,	EllipsePath2D
,	RhombusPath2D
,	GRAB
,	C2D
,	LinkMetrics
}	from './GeoDF.js'

const
DrawLinkCanvas	= ( c2D, _ ) => {

	const
	[ [ nF, nT ], A, P ] = _

	const
	$ = LinkMetrics( _ )
	if	( !$ ) return

	c2D.save()

	P.stroke			&& ( c2D.strokeStyle	= P.stroke			)
	P.lineWidth			&& ( c2D.lineWidth		= P.lineWidth		)
	P.lineCap			&& ( c2D.lineCap		= P.lineCap			)
	P.lineJoin			&& ( c2D.lineJoin		= P.lineJoin		)
	P.lineDashOffset	&& ( c2D.lineDashOffset = P.lineDashOffset	)
	P.lineDash			&& c2D.setLineDash( P.lineDash )

	c2D.beginPath()
	c2D.moveTo( ...$.shaft[ 0 ] )
	for	( let i = 1; i < $.shaft.length; i++ )	c2D.lineTo( ...$.shaft[ i ] )
	c2D.stroke()

	c2D.fillStyle = P.fill ?? P.stroke
	c2D.beginPath()
	for ( const [ [ ax, ay ], [ bx, by ], [ cx, cy ] ] of $.heads ) {
		c2D.moveTo( ax, ay )
		c2D.lineTo( bx, by )
		c2D.lineTo( cx, cy )
		c2D.closePath()
	}
	c2D.fill()

	c2D.restore()
}

const
HitLink			= ( _, xy ) => {

	const
	[ [ nF, nT ], A, P ] = _

	const
	$ = LinkMetrics( _ )
	if	( !$ ) return

	C2D.save()

	C2D.beginPath()
	C2D.moveTo( ...$.shaft[ 0 ] )
	for	( let i = 1; i < $.shaft.length; i++ )	C2D.lineTo( ...$.shaft[ i ] )
	C2D.lineWidth = Math.max( P.lineWidth ?? GRAB, GRAB )
	if	( C2D.isPointInStroke( ...xy ) ) return true

	C2D.beginPath()
	for ( const [ [ ax, ay ], [ bx, by ], [ cx, cy ] ] of $.heads ) {
		C2D.moveTo( ax, ay )
		C2D.lineTo( bx, by )
		C2D.lineTo( cx, cy )
		C2D.closePath()
	}
	try {
		return C2D.isPointInPath( ...xy )
	} finally {
		C2D.restore()
	}
}

import { DrawForeignLabel	} from './ForeignLabel.js'

const
NodeMode = ev => CREATE_NODE.checked || !!ev?.metaKey
const
LinkMode = ev => CREATE_LINK.checked || !!ev?.altKey

const
Node_XY		= xy => {
	let	$ = null
	app.model.nodes.forEach(
		_ => {
			const _tlbr = TLBR( _[ 1 ] )
			if	( ContainsXY( Outset( _tlbr, GRAB ), xy ) ) {
				if	( $ ) {
					const _minEdgeDist	= Math.min( ...EdgeDist( _tlbr, xy ) )
					const tlbr			= TLBR( $[ 1 ] )
					const minEdgeDist	= Math.min( ...EdgeDist( tlbr, xy ) )
					_minEdgeDist < minEdgeDist
					?	$ = _
					:	_minEdgeDist === minEdgeDist && ( AreaTLBR( _tlbr ) < AreaTLBR( tlbr ) ) && ( $ = _ )
				} else {
					$ = _
				}
			}
		}
	)
	return	$
}
const
Node_EV		= ev => Node_XY( XY_EV( ev ) )

const
Links_XY	= xy => AvailableLinks().reduce(
	( $, _ ) => {
		HitLink( _, xy ) && $.push( _ )
		return $
	}
,	[]
)

const
BBoxGrabCursor	= ( bbox, xy ) => {
	const
	[ T, L, B, R ] = EdgeDist( bbox, xy ).map( _ => _ <= 0 )

	if	( ( T && L ) || ( B && R ) ) return 'nwse-resize'
	if	( ( T && R ) || ( B && L ) ) return 'nesw-resize'

	if	( T || B ) return 'ns-resize'
	if	( L || R ) return 'ew-resize'

	return 'move'
}
const
Cursor_EV	= ev => {
	
	const
	xy = XY_EV( ev )

	if	( app.reforms.length ) {
		const
		bbox = BBox( app.reforms )
		if	( ContainsXY( bbox, xy ) )					return 'move'
		if	( ContainsXY( Outset( bbox, GRAB ), xy ) )	return BBoxGrabCursor( bbox, xy )
	}

	if	( NodeMode( ev ) || LinkMode( ev ) )			return 'crosshair'

	if	( Links_XY( xy ).length )						return 'pointer'

	const	node = Node_XY( xy )
	if	( node ) return BBoxGrabCursor( TLBR( node[ 1 ] ), xy )

	return	'default'
}


const
copyText		= text => navigator.clipboard.writeText( text ).catch( Report )

const
mouse			= [ null, null ]

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
		P.lineWidth			&& ( c2D.lineWidth		= P.lineWidth		)
		P.lineCap			&& ( c2D.lineCap		= P.lineCap			)
		P.lineJoin			&& ( c2D.lineJoin		= P.lineJoin		)
		P.miterLimit		&& ( c2D.miterLimit		= P.miterLimit		)
		P.lineDash			&& ( c2D.setLineDash	( P.lineDash )		)
		P.lineDashOffset	&& ( c2D.lineDashOffset	= P.lineDashOffset	)
		c2D.strokeStyle = stroke
		c2D.stroke( path )
	}
	c2D.restore()
}

const
UpdateHoverLabel = ev => {
	const
	node = Node_EV( ev )
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
		return Promise.all( [ this.DrawModel(), this.DrawReforms() ] ).catch( Report )
	}

	clearInteraction() {
		mouse[ 0 ] = mouse[ 1 ] = null
		this.drag = null
	}

	ApplyCanvasSize() {
		const
		[ w, h ] = CanvasSize()
		if	( !( w > 0 && h > 0 ) )	throw new Error( `Invalid canvas size: ${ w }×${ h }` )
		this.drawer.width		= this.reformer.width		= w
		this.drawer.height		= this.reformer.height		= h
	}

	async DrawModel() {

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
					console.error( 'Unknown:', S.type )
					break
				}
				if	( S.html )	await DrawForeignLabel( drawSVG, S )
			} catch ( er ) {
				console.error( 'DrawModel failed:', ID, er )
			}
		}

		AvailableLinks().forEach( _ => DrawLinkCanvas( c2D, _ ) )
	}

	async DrawReforms() {
		const	c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

//	TODO: REFACTOR
		//	redraw every link touching the selection: a moving end follows its
		//	reform clone, a fixed end stays on its model node ( so half-selected
		//	links track the drag instead of being left behind )
		for ( const [ [ F, T ], A, P ] of app.model.links ) {
			const	rF = FindReform( F )
			const	rT = FindReform( T )
			if	( !rF && !rT ) continue
			const	nF = rF || FindNode( F )
			const	nT = rT || FindNode( T )
			nF && nT && DrawLinkCanvas( c2D, [ [ nF, nT ], A, P ] )
//			c2D, nF[ 1 ], A, nT[ 1 ], S, { paintF: nF[ 2 ], paintT: nT[ 2 ] }
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
			//	resize handles: 4 corners fully outside the selection box
			const	HS = 8, gap = 1
			c2D.fillStyle = '#ffffff'
			c2D.lineWidth = 1.5
			for ( const [ x, y ] of [
				[ hL - HS, hT - HS ]
			,	[ hR + gap, hT - HS ]
			,	[ hL - HS, hB + gap ]
			,	[ hR + gap, hB + gap ]
			] ) {
				c2D.fillRect( x, y, HS, HS )
				c2D.strokeRect( x, y, HS, HS )
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
		//	stop the browser from claiming the drag as a scroll / gesture ( which
		//	would fire pointercancel and abort the move before pointerup commits )
		this.reformer.style.touchAction	= 'none'
		this.linkMenuKey			= null
		this.nodeMenuTarget			= null

		LINK_MENU_REMOVE.onclick	= ev => (
			ev.stopPropagation()
		,	this.linkMenuKey && RemoveLink( [ this.linkMenuKey[ 0 ], this.linkMenuKey[ 1 ] ] )
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

		//	Pointer Capture: once a drag starts we capture the pointer so move/up
		//	are delivered to the canvas even when the cursor leaves it — the release
		//	(commit) is never lost over a panel or off-window.
		this.reformer.onpointerleave	= () => ( UNDER_HOVER.style.display = 'none' )
		this.reformer.onpointerdown		= ev => this.onMouseDown( ev )
		this.reformer.onpointermove		= ev => this.onMouseMove( ev )
		this.reformer.onpointerup		= ev => this.onMouseUp( ev )
		//	if the browser cancels the pointer mid-drag, commit what we have rather
		//	than silently dropping it ( onMouseUp no-ops when nothing was dragged )
		this.reformer.onpointercancel	= ev => this.onMouseUp( ev )

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

	//	coarse cursor for the current mode ( refined per-position by cursorAt on move )
	refreshModeCursor( ev ) {
		this.reformer.style.cursor = ( NodeMode( ev ) || LinkMode( ev ) ) ? 'crosshair' : 'default'
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
			this.drag = null
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

	setEditor( node ) {
		NODE_ID.value		= node[ 0 ]
		SHAPE_EDITOR.$		= node[ 1 ]
		PAINT_EDITOR.$		= node[ 2 ]
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

	async onContextMenu( ev ) {
		const
		xy = XY_EV( ev )
		const
		links = Links_XY( xy )
		if	( links.length ) {
			ev.preventDefault()
			this.hideContextMenus()
			this.linkMenuKey	= links[ 0 ][ 0 ]
			LINK_MENU.style.display	= 'block'
			this.positionContextMenu( LINK_MENU, ev )
			return
		}
		const
		node = Node_EV( ev )
		if	( ! node ) return
		ev.preventDefault()
		this.hideContextMenus()

		app.reforms			= []
		this.registReform( node )
		await this.DrawReforms()

		this.setEditor( node )
		this.rollSelectedToTop()

		this.nodeMenuTarget		= node
		NODE_MENU.style.display	= 'block'
		this.positionContextMenu( NODE_MENU, ev )
	}

	async onMouseDown( ev ) {
		this.reformer.tabIndex = 0

		if	( ev.button ) return

		//	capture the pointer for the whole gesture so pointerup always lands here
		ev.pointerId != null && this.reformer.setPointerCapture( ev.pointerId )

		const
		xy	= mouse[ 0 ] = XY_EV( ev )

		let
		needsRedraw	= false

		try {
//	SELECTION
			if	( app.reforms.length ) {
				const
				bbox = BBox( app.reforms )
//	SELECTION GRAB
				if	( ContainsXY( bbox, xy ) ) {
					this.drag = this.beginMove()
					return
				}
//	SELECTION INSIDE
				if	( ContainsXY( Outset( bbox, GRAB ), xy ) ) {
					this.drag = this.beginResize()
					return
				}
//	SELECTION OUTSIDE
				app.reforms.length = 0
				needsRedraw = true
			}

//	LINK
			for	( const link of AvailableLinks() ) {
				const
				[ [ nF, nT ], A, P ] = link
				HitLink( link, xy ) && (
					this.registReform( nF )
				,	this.registReform( nT )
				,	LINK_EDITOR.$ = [ [ nF[ 0 ], nT[ 0 ] ], A ]
				,	PAINT_EDITOR.$ = P
				)
			}
			if	( app.reforms.length ) {
				needsRedraw = true
				this.drag = this.beginMove()
				return
			}

//	NODE — create / link modes take precedence over hitting existing nodes
			if	( NodeMode( ev ) ) {
				this.drag = this.beginCreate()
				return
			}

			const
			$ = Node_EV( ev )
			if	( LinkMode( ev ) ) {
				this.drag = $ ? this.beginLink() : this.beginArea()
				return
			}

			void (
				$
				?	(	this.drag = ContainsXY( TLBR( $[ 1 ] ), xy ) ? this.beginMove() : this.beginResize()
					,	ev.shiftKey
						?	(	this.setEditor( $ )
							,	this.registReform( $ )
							,	this.rollSelectedToTop()
							)
						:	this.addWithContained( $ )
					)
				:	this.drag = this.beginArea()
			)
		} finally {
			needsRedraw && await this.DrawReforms()
		}
	}

	//	each gesture is a { draw, commit } handler decided at mousedown:
	//	draw renders the in-progress drag, commit applies it on mouseup
	beginMove() {
		return	{
			draw	: ( c2D, d, u ) => {
				const	[ dX, dY ] = DeltaXY( d, u )
				app.reforms.forEach(
					( [ ID, S ] ) => {
						const	s = FindNode( ID )[ 1 ]
						S.cX = s.cX + dX
						S.cY = s.cY + dY
					}
				)
				return	this.DrawReforms()
			}
		,	commit	: () => Reform()
		}
	}

	beginResize() {
		return	{
			draw	: ( c2D, d, u ) => {
				let		edgeMode = false
				const	tlbr = BBox( app.reforms.map( _ => FindNode( _[ 0 ] ) ) )
				const	edgeDist = EdgeDist( tlbr, d )
				const	[ t, l, b, r ] = tlbr
				const	T = edgeDist[ 0 ] <= GRAB ? ( edgeMode = true, u[ 1 ] ) : t
				const	L = edgeDist[ 1 ] <= GRAB ? ( edgeMode = true, u[ 0 ] ) : l
				const	B = edgeDist[ 2 ] <= GRAB ? ( edgeMode = true, u[ 1 ] ) : b
				const	R = edgeDist[ 3 ] <= GRAB ? ( edgeMode = true, u[ 0 ] ) : r
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
				return	this.DrawReforms()
			}
		,	commit	: () => Reform()
		}
	}

	beginLink() {
		return	{
			draw	: ( c2D, d, u ) => {
				const	paint = PAINT_EDITOR.$
				c2D.save()
				c2D.strokeStyle = paint.stroke || 'dodgerblue'
				c2D.lineWidth = Number( paint.lineWidth || 2 )
				c2D.lineCap = paint.lineCap || 'butt'
				c2D.beginPath()
				c2D.moveTo( ...d )
				c2D.lineTo( ...u )
				c2D.stroke()
				c2D.restore()
			}
		,	commit	: async ( d, u ) => {
				const	F = Node_XY( d );	if	( F === null ) return
				const	T = Node_XY( u );	if	( T === null ) return
				const	[ , A ] = LINK_EDITOR.$
				const	$ = [ [ F[ 0 ], T[ 0 ] ], A, PAINT_EDITOR.$ ]
				await Link( $ )
			}
		}
	}

	beginCreate() {
		return	{
			draw	: ( c2D, d, u ) => {
				const	paint = PAINT_EDITOR.$
				c2D.save()
				c2D.strokeStyle = paint.stroke || 'dodgerblue'
				c2D.lineWidth = Number( paint.lineWidth || 2 )
				c2D.lineCap = paint.lineCap || 'butt'
				c2D.strokeRect( ...XYWH_XYXY( [ d, u ] ) )
				c2D.restore()
			}
		,	commit	: async ( d, u ) => {
				const	S = SHAPE_EDITOR.$
				const	r = DivXY( DeltaXY( d, u ), 2 )
				const	c = AddXY( d, r )
				S.cX = c[ 0 ]
				S.cY = c[ 1 ]
				S.rH = r[ 0 ]
				S.rV = r[ 1 ]
				await Node( [ NODE_ID.value, S, PAINT_EDITOR.$ ] )
			}
		}
	}

	beginArea() {
		return	{
			draw	: ( c2D, d, u ) => {
				c2D.save()
				c2D.strokeStyle = 'lightgray'
				c2D.strokeRect( ...XYWH_XYXY( [ d, u ] ) )
				c2D.restore()
			}
		,	commit	: ( d, u ) => {
				const	tlbr = TLBR_XYXY( [ d, u ] )
				app.model.nodes.forEach(
					_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
				)
				return	this.DrawReforms()
			}
		}
	}

	async onMouseMove( ev ) {

		UpdateHoverLabel( ev )

		if	( mouse[ 0 ] === null ) {
			this.reformer.style.cursor = Cursor_EV( ev )
			return
		}
		//	NOTE: no `!ev.buttons` reset here — pointer capture guarantees
		//	pointerup / pointercancel, and a stray buttons:0 move that the browser
		//	emits just before pointerup would otherwise drop the drag before commit.

		const
		c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		mouse[ 1 ] = [ ev.offsetX, ev.offsetY ]
		if	( EqualXY( mouse[ 0 ], mouse[ 1 ] ) ) return

		await this.drag?.draw( c2D, mouse[ 0 ], mouse[ 1 ] )
	}

	async onMouseUp( ev ) {
		void ev

		const
		drag = this.drag
		this.drag = null

		const
		[ mouseD, mouseU ] = mouse
		mouse[ 0 ] = mouse[ 1 ] = null

		if	( mouseD === null || mouseU === null ) return
		if	( EqualXY( mouseD, mouseU ) ) return

		const
		c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		await drag?.commit( mouseD, mouseU )
	}
}

customElements.define( 'main-editor', MainEditor )
