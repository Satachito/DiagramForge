import {
	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsTLBR
,	Union
} from './geo2D.js'

export const
XYWH			= ( { cX, cY, rH, rV } ) => [ cX - rH, cY - rV, rH + rH, rV + rV ]

export const
T				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY - rV : cY + rV

export const
B				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY + rV : cY - rV

export const
L				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX - rH : cX + rH

export const
R				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX + rH : cX - rH

export const
TLBR			= ( { cX, cY, rH, rV } ) => 0 < rH
?	0 < rV
	?	[ cY - rV, cX - rH, cY + rV, cX + rH ]
	:	[ cY + rV, cX - rH, cY - rV, cX + rH ]
:	0 < rV
	?	[ cY - rV, cX + rH, cY + rV, cX - rH ]
	:	[ cY + rV, cX + rH, cY - rV, cX - rH ]

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

//	point on S's outline along the ray from its center in direction ( dX, dY ).
//	ellipse / rhombus follow their real outline; rect / SVG / PNG use the bbox edge.
const
onOutline		= ( S, dX, dY ) => {
	if	( !dX && !dY ) return [ S.cX, S.cY ]
	const	rH = Math.abs( S.rH ), rV = Math.abs( S.rV )
	let		scale
	switch ( S.type ) {
	case 'ellipse'	:
		scale = 1 / Math.hypot( dX / rH, dY / rV )
		break
	case 'rhombus'	:
		scale = 1 / ( Math.abs( dX ) / rH + Math.abs( dY ) / rV )
		break
	default			: {	//	rect, SVG, PNG: bounding-box edge
		const	sH = dX ? rH / Math.abs( dX ) : Infinity
		const	sV = dY ? rV / Math.abs( dY ) : Infinity
		scale = Math.min( sH, sV )
		}
	}
	return	[ S.cX + dX * scale, S.cY + dY * scale ]
}

const
LinkCoordinates	= ( sF, aF, sT, aT ) => {
	const
	xAlong	= ( S, s, a ) =>
		a === 'TL' || a === 'BL' ? L( s ) :
		a === 'TR' || a === 'BR' ? R( s ) : S.cX
	,	yAlong	= ( S, s, a ) =>
		a === 'TL' || a === 'TR' ? T( s ) :
		a === 'BL' || a === 'BR' ? B( s ) : S.cY

	const
	$ = ( S, A, s, a ) => {
		let	P
		switch	( A ) {
		case 'TL'	: P = [ L( S ), T( S ) ]; break
		case 'TR'	: P = [ R( S ), T( S ) ]; break
		case 'BL'	: P = [ L( S ), B( S ) ]; break
		case 'BR'	: P = [ R( S ), B( S ) ]; break
		case 'T'	: P = [ xAlong( S, s, a ), T( S ) ]; break
		case 'B'	: P = [ xAlong( S, s, a ), B( S ) ]; break
		case 'L'	: P = [ L( S ), yAlong( S, s, a ) ]; break
		case 'R'	: P = [ R( S ), yAlong( S, s, a ) ]; break
		default		: return onOutline( S, s.cX - S.cX, s.cY - S.cY )
		}
		//	anchored: rects keep the box point; ellipse / rhombus project onto the outline
		return	S.type === 'ellipse' || S.type === 'rhombus'
			?	onOutline( S, P[ 0 ] - S.cX, P[ 1 ] - S.cY )
			:	P
	}
	return [ $( sF, aF, sT, aT ), $( sT, aT, sF, aF ) ]
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
distAlongSeg	= ( a, b, p ) => {
	const
	dx = b[ 0 ] - a[ 0 ]
	,	dy = b[ 1 ] - a[ 1 ]
	,	len = Math.hypot( dx, dy )
	return	len < 1e-9 ? 0 : ( ( p[ 0 ] - a[ 0 ] ) * dx + ( p[ 1 ] - a[ 1 ] ) * dy ) / len
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
frameHalf		= paint => paint?.stroke ? ( Number( paint.lineWidth ) || 1 ) / 2 : 0

const
ellipseOutward	= ( S, px, py ) => unit(
	( px - S.cX ) / ( S.rH * S.rH )
,	( py - S.cY ) / ( S.rV * S.rV )
)

const
rectEdgeOutward	= ( S, px, py ) => {
	const
	l = S.cX - S.rH
	,	r = S.cX + S.rH
	,	t = S.cY - S.rV
	,	b = S.cY + S.rV
	,	dL = Math.abs( px - l )
	,	dR = Math.abs( px - r )
	,	dT = Math.abs( py - t )
	,	dB = Math.abs( py - b )
	,	m = Math.min( dL, dR, dT, dB )
	if	( m === dT )	return [ 0, -1 ]
	if	( m === dB )	return [ 0, 1 ]
	if	( m === dL )	return [ -1, 0 ]
	return	[ 1, 0 ]
}

const
boundaryOutward	= ( S, anchor, [ px, py ] ) => {
	switch ( anchor ) {
	case 'T'	: return [ 0, -1 ]
	case 'B'	: return [ 0, 1 ]
	case 'L'	: return [ -1, 0 ]
	case 'R'	: return [ 1, 0 ]
	case 'TL'	: return unit( -S.rH, -S.rV )
	case 'TR'	: return unit( S.rH, -S.rV )
	case 'BL'	: return unit( -S.rH, S.rV )
	case 'BR'	: return unit( S.rH, S.rV )
	default		:
		switch ( S.type ) {
		case 'rect':
		case 'SVG':
		case 'PNG'	: return rectEdgeOutward( S, px, py )
		case 'ellipse'	: return ellipseOutward( S, px, py )
		default		: return unit( px - S.cX, py - S.cY )
		}
	}
}

const
offsetOutward	= ( p, outward, dist ) => [
	p[ 0 ] + outward[ 0 ] * dist
,	p[ 1 ] + outward[ 1 ] * dist
]

//	shaftHalf-independent attachment geometry; computed once per link
const
linkEnds		= ( shapeF, anchorF, shapeT, anchorT, paintF, paintT ) => {
	const
	[ pF, pT ] = LinkCoordinates( shapeF, anchorF, shapeT, anchorT )
	,	outwardF = boundaryOutward( shapeF, anchorF, pF )
	,	outwardT = boundaryOutward( shapeT, anchorT, pT )
	,	frameF = frameHalf( paintF )
	,	frameT = frameHalf( paintT )
	return	{
		pF, pT, outwardF, outwardT, frameF, frameT
	,	tipF	: offsetOutward( pF, outwardF, frameF )
	,	tipT	: offsetOutward( pT, outwardT, frameT )
	,	ortho	: !( anchorF || anchorT )
	}
}

const
routeFrom		= ( e, shaftHalf ) => {
	const
	rF = offsetOutward( e.pF, e.outwardF, e.frameF + shaftHalf )
	,	rT = offsetOutward( e.pT, e.outwardT, e.frameT + shaftHalf )
	if	( !e.ortho )	return [ rF, rT ]
	const
	midX = ( rF[ 0 ] + rT[ 0 ] ) / 2
	,	midY = ( rF[ 1 ] + rT[ 1 ] ) / 2
	return	Math.abs( e.outwardF[ 0 ] ) >= Math.abs( e.outwardF[ 1 ] )
		?	[ rF, [ midX, rF[ 1 ] ], [ midX, rT[ 1 ] ], rT ]
		:	[ rF, [ rF[ 0 ], midY ], [ rT[ 0 ], midY ], rT ]
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
linkMetrics		= ( shapeF, { headF, headT, anchorF, anchorT }, shapeT, paintF, paintT ) => {
	const
	e = linkEnds( shapeF, anchorF, shapeT, anchorT, paintF, paintT )
	,	{ tipF, tipT } = e
	,	len0 = pathLength( routeFrom( e, 0 ) )
	if	( len0 < 1 ) return null

	//	route is inset by a gap derived from the tip-to-tip length, then the head
	//	and shaft are sized from the inset route's length (matches original tuning)
	const
	gapHalf = Math.max( 2, Math.max( 5, Math.min( 14, len0 * 0.35 ) * 0.5 ) * 0.45 )
	,	route = routeFrom( e, gapHalf )
	,	len = pathLength( route )
	if	( len < 1 ) return null

	const
	headLen   = Math.min( 14, len * 0.35 )
	,	headHalf  = Math.max( 5, headLen * 0.5 )
	,	shaftHalf = Math.max( 2, headHalf * 0.45 )

	let
	fDist = 0
	,	tDist = len
	,	neckF = null
	,	neckT = null
	const
	heads = []
	if	( headF ) {
		const
		dir = unit( route[ 1 ][ 0 ] - route[ 0 ][ 0 ], route[ 1 ][ 1 ] - route[ 0 ][ 1 ] )
		neckF = [ tipF[ 0 ] + dir[ 0 ] * headLen, tipF[ 1 ] + dir[ 1 ] * headLen ]
		fDist = Math.max( 0, distAlongSeg( route[ 0 ], route[ 1 ], neckF ) )
		heads.push( headTriangle( tipF, dir, headLen, headHalf ) )
	}
	if	( headT ) {
		const
		n = route.length - 1
		,	dir = unit( route[ n - 1 ][ 0 ] - tipT[ 0 ], route[ n - 1 ][ 1 ] - tipT[ 1 ] )
		,	lastSegLen = Math.hypot(
			route[ n ][ 0 ] - route[ n - 1 ][ 0 ]
		,	route[ n ][ 1 ] - route[ n - 1 ][ 1 ]
		)
		neckT = [ tipT[ 0 ] + dir[ 0 ] * headLen, tipT[ 1 ] + dir[ 1 ] * headLen ]
		tDist = len - lastSegLen + distAlongSeg( route[ n - 1 ], route[ n ], neckT )
		tDist = Math.min( len, Math.max( fDist, tDist ) )
		heads.push( headTriangle( tipT, dir, headLen, headHalf ) )
	}
	const
	shaft = subPath( route, fDist, tDist )
	if	( shaft.length < 2 ) return null

	const
	endF = headF ? neckF : tipF
	,	endT = headT ? neckT : tipT
	if	( endT ) {
		const
		last = shaft[ shaft.length - 1 ]
		if	( Math.hypot( endT[ 0 ] - last[ 0 ], endT[ 1 ] - last[ 1 ] ) > 0.5 )	shaft.push( endT )
	}
	if	( endF ) {
		const
		first = shaft[ 0 ]
		if	( Math.hypot( endF[ 0 ] - first[ 0 ], endF[ 1 ] - first[ 1 ] ) > 0.5 )	shaft.unshift( endF )
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
LinkPath2D		= ( shapeF, ends, shapeT, paintF, paintT ) => {
	const
	m = linkMetrics( shapeF, ends, shapeT, paintF, paintT )
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
CornerGrab		= ( tlbr, xy ) => {
	const
	[ dT, dL, dB, dR ] = EdgeDist( tlbr, xy )
	,	m = MinEdge( tlbr, xy )
	if	( m >= 0 || m <= -GRAB )	return false
	return	( dT < 0 && dL < 0 )
		||	( dT < 0 && dR < 0 )
		||	( dB < 0 && dL < 0 )
		||	( dB < 0 && dR < 0 )
}

const
SelectionGrab		= CornerGrab

//	the node with the smallest edge distance (innermost) matching pred;
//	ties pick the smallest area
const
ClosestNodeWhere	= ( xy, pred ) => {
	let
	top = null
	,	best = Infinity
	,	bestArea = Infinity
	for ( const node of app.model.nodes ) {
		const
		tlbr = TLBR( node[ 1 ] )
		if	( !pred( node, tlbr, xy ) ) continue
		const
		d = MinEdge( tlbr, xy )
		,	[ t, l, b, r ] = tlbr
		,	area = ( b - t ) * ( r - l )
		if	( d < best || ( d === best && area < bestArea ) ) {
			best = d
			bestArea = area
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
	return	PointContains( BBox( app.reforms ), xy ) && !UnselectedAt( xy )
}

export const
SelectionGrabAt		= xy => app.reforms.length && SelectionGrab( BBox( app.reforms ), xy )

export const
HitSelect		= xy => {
	const
	unsel = UnselectedAt( xy )
	if	( unsel ) {
		const
		tlbr = TLBR( unsel[ 1 ] )
		if	( CornerGrab( tlbr, xy ) )			return 'nodeGrab'
		return	'nodeInside'
	}
	if	( SelectedMemberAt( xy ) )				return 'selected'
	if	( SelectionInteriorAt( xy ) )			return 'selectionInside'
	//	exterior corner grips last — still resizable when nodes overlap the edge band
	if	( SelectionGrabAt( xy ) )				return 'selectionGrab'
	return	'none'
}

//	resize cursor for the exterior GRAB band: an edge is grabbed when its
//	signed distance is within GRAB ( negative = outside, so corners win first )
export const
SelectionGrabCursor	= ( sel, xy ) => {
	const
	[ dT, dL, dB, dR ] = EdgeDist( sel, xy )
	,	T = dT <= GRAB
	,	L = dL <= GRAB
	,	B = dB <= GRAB
	,	R = dR <= GRAB
	if	( ( T && L ) || ( B && R ) )	return 'nwse-resize'
	if	( ( T && R ) || ( B && L ) )	return 'nesw-resize'
	if	( T || B )	return 'ns-resize'
	if	( L || R )	return 'ew-resize'
	return	'move'
}

//	topmost node whose body contains the point ( used for node/link creation )
export const
Node_XY		= xy => ClosestNodeWhere(
	xy
,	( _, tlbr, p ) => PointContains( tlbr, p )
)
