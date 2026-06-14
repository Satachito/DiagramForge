//	Render a node's HTML `label` (S.html) as wrapped text on a 2D canvas,
//	honoring a small subset of CSS from S.style (font, alignment, padding).

import { XYWH } from './geo2D.js'
import { parsePadding, parseLinePx, labelY } from './vector-export-common.js'

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
decodeHtml		= html => {
	const	$ = document.createElement( 'textarea' )
	$.innerHTML = html
	return	$.value
}

const
wrapLines		= ( c2D, text, maxWidth ) => {
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
				if	( c2D.measureText( next ).width > maxWidth && line ) {
					lines.push( line )
					line = words[ i ]
				} else	line = next
			}
			lines.push( line )
		}
	)
	return	lines.length ? lines : [ '' ]
}

export const
DrawLabel		= ( c2D, S ) => {
	const
	st = parseStyle( S.style )
,	fontSize = parseFloat( st[ 'font-size' ] ) || 12
,	fontWeight = st[ 'font-weight' ] || 'normal'
,	fontFamily = st[ 'font-family' ] || 'courier, monospace'
,	textAlign = ( () => {
		//	explicit text-align wins; else derive horizontal from the
		//	flex/grid justify-*; else HTML block default = left.
		const	t = st[ 'text-align' ]
		if	( t ) return t
		const	j = st[ 'justify-items' ] || st[ 'justify-content' ] || st[ 'place-items' ] || ''
		return /center/.test( j ) ? 'center' : /end/.test( j ) ? 'right' : 'left'
	} )()
,	[ x, y, w, h ] = XYWH( S )
,	{ t: padT, r: padR, b: padB, l: padL } = parsePadding( st )
,	innerW = Math.max( 0, w - padL - padR )
,	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
,	middle = st[ 'text-baseline' ] === 'middle'

	c2D.save()
	c2D.fillStyle = color
	c2D.font = `${ fontWeight } ${ fontSize }px ${ fontFamily }`
	c2D.textAlign = textAlign === 'right' ? 'right' : textAlign === 'left' ? 'left' : 'center'
	c2D.textBaseline = middle ? 'middle' : 'alphabetic'

	const
	lines = wrapLines( c2D, decodeHtml( S.html ), innerW )
,	linePx = parseLinePx( st, fontSize )
,	blockH = lines.length * linePx
,	alignItems = st[ 'align-items' ] || st[ 'place-items' ] || 'start'
,	startY = labelY( { y, h, blockH, linePx, fontSize, padT, padB, alignItems, middle } )

	const
	textX = textAlign === 'right'
	?	x + w - padR
	:	textAlign === 'left'
		?	x + padL
		:	x + w / 2

	lines.forEach(
		( line, i ) => c2D.fillText( line, textX, startY + i * linePx )
	)
	c2D.restore()
}
