import { Node		}	from './Application.js'
import { unzipSync	}	from 'https://cdn.jsdelivr.net/npm/fflate@0.6.4/esm/browser.js'
import FetchProgression	from './fetch-progression.js'
import {
	E
,	AC
,	AE
,	RoleE
}	from './DomUtils.js'

const
TE		= ( tag, innerHTML ) => {
	const
	$ = E( tag )
	$.innerHTML = innerHTML
	return $
}

const
SPAN	= innerHTML => TE( 'span'	, innerHTML )
const
SUMMARY = innerHTML => TE( 'summary', innerHTML )

const
DETAILS	= _ => {
	const
	$ = E( 'details' )
	AC( $, SUMMARY( _ ) )
	return $
}

const
IMG		= url => {
	const
	$ = document.createElement( 'img' )
	$.src = url
	$.width = 40
	$.height = 40
	return $
}
const
Base64 = bytes => {
	let
	binary = ''
	let
	i = 0
	while ( i < bytes.length ) {
		binary += String.fromCharCode( ...bytes.subarray( i, i + 0x8000 ) )
		i += 0x8000
	}
	return btoa( binary )
}

export default class
CloudIcons extends HTMLElement {

	constructor() {
		super()

		this.innerHTML = `
			<div
				style="display: flex; font-size: 9px; align-items: flex-end; margin-top: 4px"
			>	SVG:<input data-role=SVG type=checkbox checked>
				PNG:<input data-role=PNG type=checkbox>
				<fetch-progression value=${this.getAttribute( 'url' )} style="margin: 4px 8px 0 8px"></fetch-progression>
			</div>
		`
		const
		root = this.appendChild( DETAILS( this.getAttribute( 'name' ) ) )
		root.ontoggle = () => this.BuildICONs( root )

		RoleE( this, 'SVG' ).onclick = () => this.BuildICONs( root )
		RoleE( this, 'PNG' ).onclick = () => this.BuildICONs( root )
	}

	async	BuildICONs( root ) {
		if	( !root.open ) return

		const showPNG = RoleE( this, 'PNG' ).checked
		const showSVG = RoleE( this, 'SVG' ).checked

		for	( const child of Array.from( root.children ) ) child.tagName !== 'SUMMARY' && child.remove()

		if	( !( showPNG || showSVG ) ) return

		this.FETCHED || ( this.FETCHED = await this.querySelector( 'fetch-progression' ).Fetch() )

		Object.entries( unzipSync( new Uint8Array( this.FETCHED ) ) ).forEach(
			( [ path, bytes ] ) => {
				if	( path.startsWith( '__MACOSX' ) || !( path.endsWith( '.png' ) || path.endsWith( '.svg' ) ) ) return

				if	( path.endsWith( '.png' ) && !showPNG ) return
				if	( path.endsWith( '.svg' ) && !showSVG ) return

				const
				pathComponents = path.split( '/' )
				if ( pathComponents.length == 0 ) return
				let
				current = root
				let
				i = 0
				while ( i < pathComponents.length - 1 ) {
					const
					pathComponent = pathComponents[ i ]
					const
					details = Array.from(
						current.querySelectorAll( ':scope > details' )
					).find(
						_ => _.querySelector( ':scope > summary' )?.textContent.trim() === pathComponent
					)
					current = details
					?	details
					:	current.appendChild( DETAILS( pathComponent ) )
					i++
				}
				const
				row = AE( current, 'div' )
				row.setAttribute( 'path', path )
				row.style.marginLeft = '8px'
				row.style.display = 'flex'
				row.style.borderBottom = '1px solid gray'
				const
				img = row.appendChild(
					IMG(
						URL.createObjectURL(
							new Blob(
								[ bytes ]
							,	{ type: path.endsWith( '.svg' ) ? 'image/svg+xml;charset=utf-8' : 'image/png' }
							)
						)
					)
				)
				img.onload = () => {
					row.onclick = async ev => {
						const
						rH	= img.naturalWidth	/ 2
						const
						rV	= img.naturalHeight / 2
						await Node(
							path.endsWith( '.svg' )
							?	[	null
								,	{	type	: 'SVG'
									,	cX		: rH
									,	cY		: rV
									,	rH
									,	rV
									,	SVG		: Base64( bytes )
									}
								,	{}
								]
							:	[	null
								,	{	type	: 'PNG'
									,	cX		: rH
									,	cY		: rV
									,	rH
									,	rV
									,	PNG		: Base64( bytes )
									}
								,	{}
								]
						)
					}
				}
				const
				span = row.appendChild( SPAN( pathComponents[ i ] ) )
				span.style.height = '100%'
				span.style.padding = '4px'
			}
		)
	}
}

customElements.define( 'cloud-icons', CloudIcons )
