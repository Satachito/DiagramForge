import { LinkParts } from './diagram-geometry.js'
import { EscapeXML } from './DomUtils.js'

const
linkColor		= P => P.stroke || P.fill

export const
drawLinkCanvas	= ( c2D, shapeF, ends, shapeT, P ) => {
	const
	g = LinkParts( shapeF, ends, shapeT )
	const
	color = linkColor( P )
	if	( !g || !color ) return

	const
	[ [ x0, y0 ], [ x1, y1 ] ] = g.shaft
	c2D.save()
	c2D.strokeStyle = color
	c2D.lineWidth = 2 * g.shaftHalf
	c2D.lineCap = P.lineCap || 'butt'
	c2D.lineJoin = P.lineJoin || 'miter'
	c2D.setLineDash( P.lineDash?.length ? P.lineDash : [] )
	P.lineDashOffset && ( c2D.lineDashOffset = P.lineDashOffset )
	c2D.beginPath()
	c2D.moveTo( x0, y0 )
	c2D.lineTo( x1, y1 )
	c2D.stroke()
	c2D.fillStyle = color
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
	]
	P.lineJoin && a.push( `stroke-linejoin="${ P.lineJoin }"` )
	P.lineDash?.length && a.push( `stroke-dasharray="${ P.lineDash.join( ' ' ) }"` )
	P.lineDashOffset && a.push( `stroke-dashoffset="${ P.lineDashOffset }"` )
	return	a.join( ' ' )
}

const
pointsAttr		= ( X, Y, points ) => points.map(
	( [ x, y ] ) => `${ X( x ) },${ Y( y ) }`
).join( ' ' )

export const
drawLinkSvg		= ( parts, X, Y, shapeF, ends, shapeT, P ) => {
	const
	g = LinkParts( shapeF, ends, shapeT )
	const
	color = linkColor( P )
	if	( !g || !color ) return

	const
	[ [ x0, y0 ], [ x1, y1 ] ] = g.shaft
	parts.push(
		`<line x1="${ X( x0 ) }" y1="${ Y( y0 ) }" x2="${ X( x1 ) }" y2="${ Y( y1 ) }" fill="none" stroke-width="${ 2 * g.shaftHalf }" ${ strokeAttrs( P ) }/>`
	)
	for ( const head of g.heads ) {
		parts.push(
			`<polygon points="${ pointsAttr( X, Y, head ) }" fill="${ EscapeXML( color ) }" stroke="none"/>`
		)
	}
}
