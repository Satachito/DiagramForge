//	Render a node's HTML `label` (S.html) as wrapped text on a 2D canvas,
//	honoring a small subset of CSS from S.style (font, alignment, padding).

import { XYWH } from './geo2D.js'

const
colorProbe		= document.createElement( 'canvas' ).getContext( '2d' )

const
parsePadding	= st => {
	const
	num = v => parseFloat( v ) || 0
	if	( st[ 'padding-left' ] || st[ 'padding-top' ] || st[ 'padding-right' ] || st[ 'padding-bottom' ] ) {
		return {
			t	: num( st[ 'padding-top' ] )
		,	r	: num( st[ 'padding-right' ] || st[ 'padding-left' ] )
		,	b	: num( st[ 'padding-bottom' ] || st[ 'padding-top' ] )
		,	l	: num( st[ 'padding-left' ] )
		}
	}
	if	( st.padding ) {
		const
		parts = st.padding.split( /\s+/ ).map( num )
		if	( parts.length === 1 )	return { t: parts[ 0 ], r: parts[ 0 ], b: parts[ 0 ], l: parts[ 0 ] }
		if	( parts.length === 2 )	return { t: parts[ 0 ], r: parts[ 1 ], b: parts[ 0 ], l: parts[ 1 ] }
		if	( parts.length === 3 )	return { t: parts[ 0 ], r: parts[ 1 ], b: parts[ 2 ], l: parts[ 1 ] }
		if	( parts.length >= 4 )	return { t: parts[ 0 ], r: parts[ 1 ], b: parts[ 2 ], l: parts[ 3 ] }
	}
	return	{ t: 4, r: 4, b: 4, l: 4 }
}

const
parseLinePx	= ( st, fontSize ) => {
	const
	raw = st[ 'line-height' ]
	if	( !raw ) return fontSize * 1.2
	const
	n = parseFloat( raw )
	if	( /px\s*$/i.test( raw ) || n > 4 ) return n
	return	fontSize * n
}

const
parseStyle		= style => {
	const	out = {}
	if	( !style ) return out
	style.replace( /\n/g, '' ).split( ';' ).forEach(
		part => {
			const
			i = part.indexOf( ':' )
			if	( i < 0 ) return
			const
			key = part.slice( 0, i ).trim().toLowerCase()
			,	val = part.slice( i + 1 ).trim()
			key && val && ( out[ key ] = val )
		}
	)
	return	out
}

const
parseColor		= color => {
	colorProbe.fillStyle = '#000000'
	colorProbe.fillStyle = color
	return	colorProbe.fillStyle
}

const
labelColor		= st => {
	if	( st.color ) return parseColor( st.color )
	return	matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
}

const
deriveTextAlign	= st => {
	const
	t = st[ 'text-align' ]
	if	( t ) return t
	const
	j = st[ 'justify-items' ] || st[ 'justify-content' ] || st[ 'place-items' ] || ''
	return /center/.test( j ) ? 'center' : /end/.test( j ) ? 'right' : 'left'
}

const
deriveAlignItems	= st => st[ 'align-items' ] || st[ 'place-items' ] || 'center'

const
alignStart	= _ => /^(flex-start|start)$/.test( _ )
,	alignEnd	= _ => /^(flex-end|end)$/.test( _ )

const
labelY		= ( { y, h, blockH, linePx, fontSize, padT, padB, alignItems, middle } ) => {
	if	( middle ) {
		if	( alignEnd( alignItems ) )	return y + h - padB - blockH + linePx / 2
		if	( alignStart( alignItems ) )	return y + padT + linePx / 2
		return	y + ( h - blockH ) / 2 + linePx / 2
	}
	if	( alignEnd( alignItems ) )	return y + h - padB - blockH + fontSize
	if	( alignStart( alignItems ) )	return y + padT + fontSize
	return	y + ( h - blockH ) / 2 + fontSize
}

const
decodeHtml		= html => {
	const	$ = document.createElement( 'textarea' )
	$.innerHTML = html
	return	$.value
}

const
wrapLines		= ( measure, text, maxWidth ) => {
	const
	lines = []
	text.split( /\n|<br\s*\/?>/i ).forEach(
		paragraph => {
			const
			words = paragraph.trim().split( /\s+/ ).filter( Boolean )
			if	( !words.length ) {
				lines.push( '' )
				return
			}
			let
			line = words[ 0 ]
			for	( let i = 1; i < words.length; i++ ) {
				const
				next = `${ line } ${ words[ i ] }`
				if	( measure( next ) > maxWidth && line ) {
					lines.push( line )
					line = words[ i ]
				} else	line = next
			}
			lines.push( line )
		}
	)
	return	lines.length ? lines : [ '' ]
}

const
computeLabelLayout	= ( S, measure ) => {
	const
	st = parseStyle( S.style )
	,	fontSize = parseFloat( st[ 'font-size' ] ) || 12
	,	fontWeight = st[ 'font-weight' ] || 'normal'
	,	fontFamily = st[ 'font-family' ] || 'courier, monospace'
	,	textAlign = deriveTextAlign( st )
	,	alignItems = deriveAlignItems( st )
	,	[ x, y, w, h ] = XYWH( S )
	,	{ t: padT, r: padR, b: padB, l: padL } = parsePadding( st )
	,	innerW = Math.max( 0, w - padL - padR )
	,	color = labelColor( st )
	,	middle = st[ 'text-baseline' ] === 'middle'
	,	lines = wrapLines( measure, decodeHtml( S.html ), innerW )
	,	linePx = parseLinePx( st, fontSize )
	,	blockH = lines.length * linePx
	,	startY = labelY( { y, h, blockH, linePx, fontSize, padT, padB, alignItems, middle } )
	,	textX = textAlign === 'right'
	?	x + w - padR
	:	textAlign === 'left'
	?	x + padL
	:	x + w / 2
	return {
		lines
	,	fontSize
	,	fontWeight
	,	fontFamily
	,	textAlign
	,	textX
	,	startY
	,	linePx
	,	color
	,	textBaseline	: middle ? 'middle' : 'alphabetic'
	}
}

export const
LabelLayout		= S => {
	const
	st = parseStyle( S.style )
	,	fontSize = parseFloat( st[ 'font-size' ] ) || 12
	,	fontWeight = st[ 'font-weight' ] || 'normal'
	,	fontFamily = st[ 'font-family' ] || 'courier, monospace'
	,	measureCanvas = document.createElement( 'canvas' ).getContext( '2d' )
	measureCanvas.font = `${ fontWeight } ${ fontSize }px ${ fontFamily }`
	return	computeLabelLayout( S, _ => measureCanvas.measureText( _ ).width )
}

export const
DrawLabel		= ( c2D, S ) => {
	const
	st = parseStyle( S.style )
	,	fontSize = parseFloat( st[ 'font-size' ] ) || 12
	,	fontWeight = st[ 'font-weight' ] || 'normal'
	,	fontFamily = st[ 'font-family' ] || 'courier, monospace'
	,	layout = ( () => {
			c2D.save()
			c2D.font = `${ fontWeight } ${ fontSize }px ${ fontFamily }`
			const
			$ = computeLabelLayout( S, _ => c2D.measureText( _ ).width )
			c2D.restore()
			return	$
		} )()

	c2D.save()
	c2D.fillStyle = layout.color
	c2D.font = `${ fontWeight } ${ fontSize }px ${ fontFamily }`
	c2D.textAlign = layout.textAlign === 'right' ? 'right' : layout.textAlign === 'left' ? 'left' : 'center'
	c2D.textBaseline = layout.textBaseline === 'middle' ? 'middle' : 'alphabetic'

	layout.lines.forEach(
		( line, i ) => c2D.fillText( line, layout.textX, layout.startY + i * layout.linePx )
	)
	c2D.restore()
}
