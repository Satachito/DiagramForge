import {
	E
}	from './DomUtils.js'

import {
	Union
} from './Geo2D.js'

export const
C2D				= E('canvas').getContext( '2d' )

export const
GRAB			= 8

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

//	auto end facing an anchored end: when the anchored attach point p lies within
//	the auto rect's vertical span ( and the anchor has an L/R side ) attach on the
//	near vertical edge at p.y → a horizontal connector; when it lies within the
//	horizontal span ( anchor has a T/B side ) attach on the near horizontal edge at
//	p.x → a vertical connector. Otherwise fall back to the centre-ray outline point.
//	rect / SVG / PNG only; ellipse / rhombus keep their curved attach.
const
autoPerp		= ( S, [ px, py ], aOther ) => {
	if	( S.type !== 'ellipse' && S.type !== 'rhombus' ) {
		const	hasH = aOther.includes( 'L' ) || aOther.includes( 'R' )
		,		hasV = aOther.includes( 'T' ) || aOther.includes( 'B' )
		if	( hasH && T( S ) < py && py < B( S ) )	return [ px <= S.cX ? L( S ) : R( S ), py ]
		if	( hasV && L( S ) < px && px < R( S ) )	return [ px, py <= S.cY ? T( S ) : B( S ) ]
	}
	return	onOutline( S, px - S.cX, py - S.cY )
}

const
linkCoordinates	= ( [ [ nF, nT ], A, P ] ) => {
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
	const
	aF = A.anchorF, aT = A.anchorT
	const
	pF = $( nF[ 1 ], aF, nT[ 1 ], aT )
	,	pT = $( nT[ 1 ], aT, nF[ 1 ], aF )
	//	exactly one end anchored: route the auto end perpendicular to the edge it hits
	if	( aF && !aT )	return [ pF, autoPerp( nT[ 1 ], pF, aF ) ]
	if	( aT && !aF )	return [ autoPerp( nF[ 1 ], pT, aT ), pT ]
	return [ pF, pT ]
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

//	unit direction ( and length ) of the route's first / last non-degenerate
//	segment, measured inward from the matching endpoint
const
endDir			= ( pts, atStart ) => {
	if	( atStart ) {
		const	a = pts[ 0 ]
		for	( let i = 1; i < pts.length; i++ ) {
			const
			dx = pts[ i ][ 0 ] - a[ 0 ]
			,	dy = pts[ i ][ 1 ] - a[ 1 ]
			,	d = Math.hypot( dx, dy )
			if	( d > 1e-6 ) return [ dx / d, dy / d, d ]
		}
	} else {
		const	a = pts[ pts.length - 1 ]
		for	( let i = pts.length - 2; i >= 0; i-- ) {
			const
			dx = pts[ i ][ 0 ] - a[ 0 ]
			,	dy = pts[ i ][ 1 ] - a[ 1 ]
			,	d = Math.hypot( dx, dy )
			if	( d > 1e-6 ) return [ dx / d, dy / d, d ]
		}
	}
	return	[ 0, 0, 0 ]
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

//	per-style arrowhead geometry. dir points inward ( tip -> shaft ). returns a
//	drawable descriptor plus `consume`: how much of the shaft to trim at this end
//	so the shaft meets the head cleanly.
//	  kind 'poly'   + fill   -> filled polygon ( triangle / diamond )
//	  kind 'poly'   + !fill  -> stroked closed polygon ( hollow triangle / diamond )
//	  kind 'line'            -> stroked open polyline ( open V )
//	  kind 'circle' + fill   -> filled / stroked disc
const
headGeometry		= ( style, tip, dir, headLen, headHalf ) => {
	const
	[ dx, dy ] = dir
	,	nx = -dy
	,	ny = dx
	,	neck = [ tip[ 0 ] + dx * headLen, tip[ 1 ] + dy * headLen ]
	,	bL = [ neck[ 0 ] + nx * headHalf, neck[ 1 ] + ny * headHalf ]
	,	bR = [ neck[ 0 ] - nx * headHalf, neck[ 1 ] - ny * headHalf ]
	switch	( style ) {
	case 'open'		:
		return	{ kind: 'line', pts: [ bL, tip, bR ], consume: 0 }
	case 'hollow'	:
		return	{ kind: 'poly', fill: false, pts: [ tip, bL, bR ], consume: headLen }
	case 'diamond'	:
	case 'diamondHollow'	: {
		const
		mid = [ tip[ 0 ] + dx * headLen * 0.5, tip[ 1 ] + dy * headLen * 0.5 ]
		,	dL = [ mid[ 0 ] + nx * headHalf, mid[ 1 ] + ny * headHalf ]
		,	dR = [ mid[ 0 ] - nx * headHalf, mid[ 1 ] - ny * headHalf ]
		return	{ kind: 'poly', fill: style === 'diamond', pts: [ tip, dL, neck, dR ], consume: headLen }
	}
	case 'circle'	:
	case 'circleHollow'	:
		return	{
			kind	: 'circle'
		,	fill	: style === 'circle'
		,	center	: [ tip[ 0 ] + dx * headLen * 0.5, tip[ 1 ] + dy * headLen * 0.5 ]
		,	r		: headLen * 0.5
		,	consume	: headLen
		}
	default			:	//	'triangle' ( also the fallback for legacy `true` )
		return	{ kind: 'poly', fill: true, pts: [ tip, bL, bR ], consume: headLen }
	}
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

//	attachment geometry ( boundary points, outward normals, stroke-frame insets
//	and resulting boundary tips ); computed once per link
const
linkEnds		= ( [ [ nF, nT ], A, P ] ) => {
	const
	[ pF, pT ] = linkCoordinates( [ [ nF, nT ], A, P ] )
,	outwardF = boundaryOutward( nF[ 1 ], A.anchorF, pF )
,	outwardT = boundaryOutward( nT[ 1 ], A.anchorT, pT )
,	frameF = frameHalf( nF[ 2 ] )
,	frameT = frameHalf( nT[ 2 ] )
	return	{
		pF, pT, outwardF, outwardT, frameF, frameT
	,	tipF	: offsetOutward( pF, outwardF, frameF )
	,	tipT	: offsetOutward( pT, outwardT, frameT )
	,	ortho	: !( A.anchorF || A.anchorT )
	}
}

//	centerline route whose endpoints are exactly the boundary tips, so the
//	arrowheads, their necks and the shaft all share one geometry
const
routeFrom		= e => {
	const
	rF = e.tipF
,	rT = e.tipT
	if	( !e.ortho )	return [ rF, rT ]
	const
	midX = ( rF[ 0 ] + rT[ 0 ] ) / 2
,	midY = ( rF[ 1 ] + rT[ 1 ] ) / 2
	return	Math.abs( e.outwardF[ 0 ] ) >= Math.abs( e.outwardF[ 1 ] )
	?	[ rF, [ midX, rF[ 1 ] ], [ midX, rT[ 1 ] ], rT ]
	:	[ rF, [ rF[ 0 ], midY ], [ rT[ 0 ], midY ], rT ]
}

export	const
LinkMetrics		= ( [ [ nF, nT ], A, P ] ) => {

	const
	e = linkEnds( [ [ nF, nT ], A, P ] )
,	route = routeFrom( e )
,	len = pathLength( route )
	if	( len < 1 ) return null

	//	head size scales with the shaft width ( so a thick line gets a proportional
	//	head ), with a sensible floor and a cap relative to the link length
	const
	lw = Number( P.lineWidth ) || 1
,	headLen  = Math.min( len * 0.4, Math.max( 12, lw * 3 ) )
,	headHalf = Math.max( 4, headLen * 0.5 )

	//	each arrowhead lies along its own end segment of the centerline and is
	//	never longer than that segment, so its neck stays on the centerline; the
	//	shaft is then the centerline between the two necks
	const
	heads = []
	let
	fDist = 0
,	tDist = len

	if	( A.headF ) {
		const
		[ ux, uy, segLen ] = endDir( route, true )
	,	hl = Math.min( headLen, segLen )
	,	h = headGeometry( A.headF, route[ 0 ], [ ux, uy ], hl, headHalf )
		heads.push( h )
		fDist = h.consume
	}
	if	( A.headT ) {
		const
		[ ux, uy, segLen ] = endDir( route, false )
	,	hl = Math.min( headLen, segLen )
	,	h = headGeometry( A.headT, route[ route.length - 1 ], [ ux, uy ], hl, headHalf )
		heads.push( h )
		tDist = len - h.consume
	}
	if	( tDist < fDist )	tDist = fDist

	const
	shaft = subPath( route, fDist, tDist )
	return {
		shaft	: shaft.length < 2 ? [ route[ 0 ], route[ route.length - 1 ] ] : shaft
	,	heads
	}
}

