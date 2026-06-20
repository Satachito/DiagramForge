import { LinkParts } from './GeoDF.js'
import { EscapeXML } from './DomUtils.js'

const
linkColor		= P => P.stroke || P.fill

export const
DrawLinkCanvas	= ( c2D, shapeF, ends, shapeT, P, paints ) => {
	const
	g = LinkParts( shapeF, ends, shapeT, paints )
	const
	color = linkColor( P )
	if	( !g || !color ) return

	c2D.save()

	c2D.strokeStyle		= color
	c2D.lineWidth		= 2 * g.shaftHalf
	P.lineCap			&& ( c2D.lineCap		= P.lineCap			)
	P.lineJoin			&& ( c2D.lineJoin		= P.lineJoin		)
	P.lineDashOffset	&& ( c2D.lineDashOffset = P.lineDashOffset	)
	P.lineDash			&& c2D.setLineDash( P.lineDash )

	c2D.beginPath()
	c2D.moveTo( ...g.shaft[ 0 ] )
	for	( let i = 1; i < g.shaft.length; i++ )	c2D.lineTo( ...g.shaft[ i ] )
	c2D.stroke()
	c2D.fillStyle	 	= color
	for ( const [ [ ax, ay ], [ bx, by ], [ cx, cy ] ] of g.heads ) {
		c2D.beginPath()
		c2D.moveTo( ax, ay )
		c2D.lineTo( bx, by )
		c2D.lineTo( cx, cy )
		c2D.closePath()
		c2D.fill()
	}
	c2D.restore()
}

const
strokeAttrs		= P => {
	const
	a = [
		`stroke="${ EscapeXML( linkColor( P ) ) }"`
	,	`stroke-linecap="${ P.lineCap || 'butt' }"`
	,	`stroke-linejoin="${ P.lineJoin || 'round' }"`
	]
	P.lineDash			&& a.push( `stroke-dasharray="${ P.lineDash.join( ' ' ) }"` )
	P.lineDashOffset	&& a.push( `stroke-dashoffset="${ P.lineDashOffset }"` )
	return a.join( ' ' )
}

const
pointsAttr		= ( X, Y, points ) => points.map(
	( [ x, y ] ) => `${ X( x ) },${ Y( y ) }`
).join( ' ' )

export const
DrawLinkSvg		= ( parts, X, Y, shapeF, ends, shapeT, P, paints ) => {
	const
	g = LinkParts( shapeF, ends, shapeT, paints )
	const
	color = linkColor( P )
	if	( !g || !color ) return

	parts.push(
		`<polyline points="${ pointsAttr( X, Y, g.shaft ) }" fill="none" stroke-width="${ 2 * g.shaftHalf }" ${ strokeAttrs( P ) }"/>`
	)
	for ( const head of g.heads ) {
		parts.push(
			`<polygon points="${ pointsAttr( X, Y, head ) }" fill="${ EscapeXML( color ) }" stroke="none"/>`
		)
	}
}
