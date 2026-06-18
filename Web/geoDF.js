import {
	XYWH
,	T
,	B
,	L
,	R
,	TLBR
,	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsTLBR
,	Union
} from './geo2D.js'

import { FindReform } from './Application.js'

export const
BBox			= _ => Union( _.map( _ => TLBR( _[ 1 ] ) ) )

export const
RectPath2D		= S => {
	const	$ = new Path2D
	$.roundRect( ...XYWH( S ), S.radii ?? 0 )
	return	$
}

export const
EllipsePath2D	= ( { cX, cY, rH, rV } ) => {
	const	$ = new Path2D
	$.ellipse( cX, cY, rH, rV, 0, 0, 2 * Math.PI )
	return	$
}

export const
RhombusPath2D	= ( { cX, cY, rH, rV } ) => {
	const	$ = new Path2D
	$.moveTo( cX, cY - rV )
	$.lineTo( cX + rH, cY )
	$.lineTo( cX, cY + rV )
	$.lineTo( cX - rH, cY )
	$.closePath()
	return	$
}

const
LinkCoordinates	= ( sF, aF, sT, aT ) => {
	const
	$ = ( S, A, s, a ) => {
		switch	( A ) {
		case "TL"	: return [ L( S ), T( S ) ]
		case "TR"	: return [ R( S ), T( S ) ]
		case "BL"	: return [ L( S ), B( S ) ]
		case "BR"	: return [ R( S ), B( S ) ]
		case "T"	: switch	( a ) {
			case "TL"	: return [ L( s )	, T( S )	]
			case "TR"	: return [ R( s )	, T( S )	]
			case "BL"	: return [ L( s )	, T( S )	]
			case "BR"	: return [ R( s )	, T( S )	]
			default		: return [ S.cX		, T( S )	]
			}
		case "L"	: switch	( a ) {
			case "TL"	: return [ L( S )	, T( s )	]
			case "TR"	: return [ L( S )	, T( s )	]
			case "BL"	: return [ L( S )	, B( s )	]
			case "BR"	: return [ L( S )	, B( s )	]
			default		: return [ L( S )	, S.cY		]
			}
		case "B"	: switch	( a ) {
			case "TL"	: return [ L( s )	, B( S )	]
			case "TR"	: return [ R( s )	, B( S )	]
			case "BL"	: return [ L( s )	, B( S )	]
			case "BR"	: return [ R( s )	, B( S )	]
			default		: return [ S.cX		, B( S )	]
			}
		case "R"	: switch	( a ) {
			case "TL"	: return [ R( S )	, T( s )	]
			case "TR"	: return [ R( S )	, T( s )	]
			case "BL"	: return [ R( S )	, B( s )	]
			case "BR"	: return [ R( S )	, B( s )	]
			default		: return [ R( S )	, S.cY		]
			}
		default:
			{	const	dX = s.cX - S.cX
				const	dY = s.cY - S.cY
				if	( !dX && !dY ) return [ S.cX, S.cY ]
				const	sH = dX ? Math.abs( S.rH / dX ) : Infinity
				const	sV = dY ? Math.abs( S.rV / dY ) : Infinity
				const	scale = sH < sV ? sH : sV
				return	[ S.cX + dX * scale, S.cY + dY * scale ]
			}
		}
	}
	return [
		$( sF, aF, sT, aT )
	,	$( sT, aT, sF, aF )
	]
}

const
unit			= ( x, y ) => {
	const
	len = Math.hypot( x, y )
	return	len < 1e-9 ? [ 0, 0 ] : [ x / len, y / len ]
}

const
pathLength		= pts => {
	let
	sum = 0
	for	( let i = 1; i < pts.length; i++ ) {
		sum += Math.hypot( pts[ i ][ 0 ] - pts[ i - 1 ][ 0 ], pts[ i ][ 1 ] - pts[ i - 1 ][ 1 ] )
	}
	return	sum
}

const
subPath			= ( pts, d0, d1 ) => {
	const
	out = []
	let
	dist = 0
	for	( let i = 1; i < pts.length; i++ ) {
		const
		[ ax, ay ] = pts[ i - 1 ]
		,	[ bx, by ] = pts[ i ]
		const
		segLen = Math.hypot( bx - ax, by - ay )
		if	( segLen < 1e-9 ) continue
		const
		segStart = dist
		,	segEnd = dist + segLen
		if	( segEnd <= d0 ) {
			dist = segEnd
			continue
		}
		if	( segStart >= d1 ) break
		const
		t0 = Math.max( 0, ( d0 - segStart ) / segLen )
		,	t1 = Math.min( 1, ( d1 - segStart ) / segLen )
		,	add = t => [ ax + ( bx - ax ) * t, ay + ( by - ay ) * t ]
		,	p0 = add( t0 )
		,	p1 = add( t1 )
		if	( !out.length )	out.push( p0 )
		else {
			const
			last = out[ out.length - 1 ]
			if	( last[ 0 ] !== p0[ 0 ] || last[ 1 ] !== p0[ 1 ] )	out.push( p0 )
		}
		if	( p1[ 0 ] !== out[ out.length - 1 ][ 0 ] || p1[ 1 ] !== out[ out.length - 1 ][ 1 ] )	out.push( p1 )
		dist = segEnd
	}
	return	out
}

const
headTriangle		= ( tip, dir, headLen, headHalf ) => {
	const
	[ dx, dy ] = dir
	,	nx = -dy
	,	ny = dx
	,	neck = [ tip[ 0 ] + dx * headLen, tip[ 1 ] + dy * headLen ]
	return	[
		tip
	,	[ neck[ 0 ] + nx * headHalf, neck[ 1 ] + ny * headHalf ]
	,	[ neck[ 0 ] - nx * headHalf, neck[ 1 ] - ny * headHalf ]
	]
}

const
routePoints		= ( shapeF, { anchorF, anchorT }, shapeT ) => {
	const	[ [ pFX, pFY ], [ pTX, pTY ] ] = LinkCoordinates( shapeF, anchorF, shapeT, anchorT )
	if	( anchorF || anchorT )	return [ [ pFX, pFY ], [ pTX, pTY ] ]

	const
	midX = ( pFX + pTX ) / 2
	,	midY = ( pFY + pTY ) / 2
	if	( Math.abs( pTX - pFX ) >= Math.abs( pTY - pFY ) ) {
		return [ [ pFX, pFY ], [ midX, pFY ], [ midX, pTY ], [ pTX, pTY ] ]
	}
	return [ [ pFX, pFY ], [ pFX, midY ], [ pTX, midY ], [ pTX, pTY ] ]
}

const
outlinePath		= ( pts, half ) => {
	if	( pts.length < 2 ) return []
	const
	left = []
	,	right = []
	for	( let i = 0; i < pts.length; i++ ) {
		let
		dx
		,	dy
		if	( i === 0 ) {
			dx = pts[ 1 ][ 0 ] - pts[ 0 ][ 0 ]
			dy = pts[ 1 ][ 1 ] - pts[ 0 ][ 1 ]
		} else if	( i === pts.length - 1 ) {
			dx = pts[ i ][ 0 ] - pts[ i - 1 ][ 0 ]
			dy = pts[ i ][ 1 ] - pts[ i - 1 ][ 1 ]
		} else {
			const
			d0 = unit( pts[ i ][ 0 ] - pts[ i - 1 ][ 0 ], pts[ i ][ 1 ] - pts[ i - 1 ][ 1 ] )
			,	d1 = unit( pts[ i + 1 ][ 0 ] - pts[ i ][ 0 ], pts[ i + 1 ][ 1 ] - pts[ i ][ 1 ] )
			;[ dx, dy ] = unit( d0[ 0 ] + d1[ 0 ], d0[ 1 ] + d1[ 1 ] )
		}
		const
		[ nx, ny ] = unit( -dy, dx )
		,	ox = nx * half
		,	oy = ny * half
		left.push( [ pts[ i ][ 0 ] + ox, pts[ i ][ 1 ] + oy ] )
		right.push( [ pts[ i ][ 0 ] - ox, pts[ i ][ 1 ] - oy ] )
	}
	return [ ...left, ...right.reverse() ]
}

const
linkMetrics		= ( shapeF, { headF, headT, anchorF, anchorT }, shapeT ) => {
	const
	route = routePoints( shapeF, { anchorF, anchorT }, shapeT )
	,	len = pathLength( route )
	if	( len < 1 ) return null

	const
	headLen = Math.min( 14, len * 0.35 )
	,	headHalf = Math.max( 5, headLen * 0.5 )
	,	shaftHalf = Math.max( 2, headHalf * 0.45 )
	,	fDist = headF ? headLen : 0
	,	tDist = len - ( headT ? headLen : 0 )
	,	shaft = subPath( route, fDist, tDist )
	if	( shaft.length < 2 ) return null

	const
	heads = []
	if	( headF ) {
		const
		dir = unit( route[ 1 ][ 0 ] - route[ 0 ][ 0 ], route[ 1 ][ 1 ] - route[ 0 ][ 1 ] )
		heads.push( headTriangle( route[ 0 ], dir, headLen, headHalf ) )
	}
	if	( headT ) {
		const
		n = route.length - 1
		,	dir = unit( route[ n ][ 0 ] - route[ n - 1 ][ 0 ], route[ n ][ 1 ] - route[ n - 1 ][ 1 ] )
		heads.push( headTriangle( route[ n ], dir, headLen, headHalf ) )
	}
	return {
		shaftHalf
	,	shaft
	,	heads
	}
}

export const
LinkParts		= linkMetrics

export const
LinkPoints		= ( shapeF, ends, shapeT ) => {
	const
	m = linkMetrics( shapeF, ends, shapeT )
	if	( !m ) return []
	return	outlinePath( m.shaft, m.shaftHalf )
}

export const
LinkPath2D		= ( shapeF, ends, shapeT ) => {
	const
	m = linkMetrics( shapeF, ends, shapeT )
	const	$ = new Path2D
	if	( !m ) return $

	const
	body = outlinePath( m.shaft, m.shaftHalf )
	if	( body.length ) {
		$.moveTo( ...body[ 0 ] )
		for	( let i = 1; i < body.length; i++ )	$.lineTo( ...body[ i ] )
		$.closePath()
	}
	for	( const tri of m.heads ) {
		$.moveTo( ...tri[ 0 ] )
		$.lineTo( ...tri[ 1 ] )
		$.lineTo( ...tri[ 2 ] )
		$.closePath()
	}
	return	$
}

//	Hit-testing for select mode: classify a point against the nodes and the
//	current selection, and pick the node a click should act on. Reads the global
//	`app` (model + reforms); pure otherwise.

//	px tolerance for grabbing a selection edge (resize handles) / click-selecting a node
export const
GRAB			= 8

const
MinEdge			= ( tlbr, xy ) => Math.min( ...EdgeDist( tlbr, xy ) )

const
PointContains	= ( tlbr, xy ) => MinEdge( tlbr, xy ) >= 0

export const
NodeInterior	= ( tlbr, xy ) => MinEdge( tlbr, xy ) > GRAB

const
SelectionGrab	= ( tlbr, xy ) => {
	const
	m = MinEdge( tlbr, xy )
	return	m > -GRAB && m <= GRAB
}

//	the node with the smallest edge distance (innermost) matching pred
const
ClosestNodeWhere	= ( xy, pred ) => {
	let
	top = null
	,	best = Infinity
	for ( const node of app.model.nodes ) {
		const
		tlbr = TLBR( node[ 1 ] )
		if	( !pred( node, tlbr, xy ) ) continue
		const
		d = MinEdge( tlbr, xy )
		if	( d < best ) {
			best = d
			top = node
		}
	}
	return	top
}

export const
SelectedMemberAt	= xy => ClosestNodeWhere(
	xy
,	( node, tlbr, p ) => FindReform( node[ 0 ] ) && PointContains( tlbr, p )
)

export const
UnselectedAt		= xy => ClosestNodeWhere(
	xy
,	( node, tlbr, p ) => !FindReform( node[ 0 ] ) && PointContains( tlbr, p )
)

export const
SelectionInteriorAt	= xy => {
	if	( !app.reforms.length ) return false
	const
	sel = BBox( app.reforms )
	return	MinEdge( sel, xy ) > GRAB
	&&	!UnselectedAt( xy )
}

export const
SelectionGrabAt		= xy => app.reforms.length && SelectionGrab( BBox( app.reforms ), xy )

export const
HitSelect		= xy => {
	//	Resize handles on the current selection win over any node underneath, so a
	//	selected box can be resized even when other nodes overlap its edge band
	//	(an icon inside a container, a container's children, adjacent boxes…).
	if	( SelectionGrabAt( xy ) )			return 'selectionGrab'
	const
	unsel = UnselectedAt( xy )
	if	( unsel ) {
		const
		tlbr = TLBR( unsel[ 1 ] )
		return NodeInterior( tlbr, xy ) ? 'nodeInside' : 'nodeGrab'
	}
	if	( SelectedMemberAt( xy ) )			return 'selected'
	if	( SelectionInteriorAt( xy ) )		return 'selectionInside'
	return	'none'
}

export const
SelectionGrabCursor	= ( sel, xy ) => {
	const
	[ dT, dL, dB, dR ] = EdgeDist( sel, xy )
	,	top = dT <= GRAB
	,	bottom = dB <= GRAB
	,	left = dL <= GRAB
	,	right = dR <= GRAB
	if	( ( top && left ) || ( bottom && right ) )	return 'nwse-resize'
	if	( ( top && right ) || ( bottom && left ) )	return 'nesw-resize'
	if	( top || bottom )	return 'ns-resize'
	if	( left || right )	return 'ew-resize'
	return	'move'
}

//	topmost node whose body contains the point ( used for node/link creation )
export const
Node_XY		= xy => ClosestNodeWhere(
	xy
,	( _, tlbr, p ) => PointContains( tlbr, p )
)
