import { Report, Node	}	from './Application.js'
import { unzip			}	from './unzip.js'
import {
	E
,	AC
,	AE
,	RoleE
}	from './DomUtils.js'

const
iconFilter = path =>
	!path.startsWith( '__MACOSX' )
&&	( path.endsWith( '.png' ) || path.endsWith( '.svg' ) )

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

//	loading spinner centered over the cloud-icons' closed-state area ( the
//	checkbox row + summary header ). it's created before any icons are added, so
//	the host rect at that moment is exactly the collapsed region
const
SPINNER = host => {
	const
	$ = E( 'div' )
	$.className = 'icon-spinner-wrap'
	const
	r = host.getBoundingClientRect()
	$.style.left	= `${ r.left }px`
	$.style.top		= `${ r.top }px`
	$.style.width	= `${ r.width }px`
	$.style.height	= `${ r.height }px`
	const
	s = E( 'div' )
	s.className = 'icon-spinner'
	AC( $, s )
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

const
clearIcons = root => {
	for	( const child of Array.from( root.children ) ) {
		child.tagName !== 'SUMMARY' && child.remove()
	}
}

//	build one clickable icon row. the image ( object URL ) is only created when
//	this runs, so callers can defer it until a folder is actually opened
const
iconRow = ( parent, { name, path, bytes } ) => {
	const
	row = AE( parent, 'div' )
	row.setAttribute( 'path', path )
	row.style.marginLeft	= '8px'
	row.style.display		= 'flex'
	row.style.borderBottom	= '1px solid gray'
	const
	isSVG = path.endsWith( '.svg' )
	,	img = row.appendChild(
		IMG(
			URL.createObjectURL(
				new Blob(
					[ bytes ]
				,	{ type: isSVG ? 'image/svg+xml;charset=utf-8' : 'image/png' }
				)
			)
		)
	)
	img.onload = () => {
		row.onclick = async () => {
			const
			rH	= img.naturalWidth	/ 2
			,	rV	= img.naturalHeight / 2
			await Node(
				isSVG
				?	[ null, { type: 'SVG', cX: rH, cY: rV, rH, rV, SVG: Base64( bytes ) }, {} ]
				:	[ null, { type: 'PNG', cX: rH, cY: rV, rH, rV, PNG: Base64( bytes ) }, {} ]
			)
		}
	}
	const
	span = row.appendChild( SPAN( name ) )
	span.style.height	= '100%'
	span.style.padding	= '4px'
}

//	render a folder tree node into parent. sub-folders get their summaries now
//	but their contents ( images included ) are built lazily on first expand
const
renderFolder = ( parent, node ) => {
	for ( const [ name, child ] of node.dirs ) {
		const
		d = parent.appendChild( DETAILS( name ) )
		let
		built = false
		d.ontoggle = () => {
			if	( !d.open || built ) return
			built = true
			renderFolder( d, child )
		}
	}
	for ( const file of node.files ) iconRow( parent, file )
}

export default class
CloudIcons extends HTMLElement {

	constructor() {
		super()
		this._buildGen = 0

		this.innerHTML = `
			<div
				style="display: flex; font-size: 9px; align-items: flex-end; margin-top: 4px"
			>	SVG:<input data-role=SVG type=checkbox checked>
				PNG:<input data-role=PNG type=checkbox>
			</div>
		`
		const
		root = this.appendChild( DETAILS( this.getAttribute( 'name' ) ) )
	,	build = () => root.open && this.BuildICONs( root ).catch( Report )
		root.ontoggle = build

		RoleE( this, 'SVG' ).onclick = build
		RoleE( this, 'PNG' ).onclick = build
	}

	async	fetchZip() {
		const
		url = this.getAttribute( 'url' )
		if	( !url ) throw new Error( 'No url attribute' )
		this._fetchPromise || (
			this._fetchPromise = fetch( url ).then(
				r => {
					if	( !r.ok ) throw new Error( `${ r.status } ${ r.statusText }` )
					return r.arrayBuffer()
				}
			).then(
				buf => {
					this.FETCHED = new Uint8Array( buf )
					return this.FETCHED
				}
			,	er => {
					this._fetchPromise = null
					throw er
				}
			)
		)
		return	this._fetchPromise
	}

	async	unzipIcons() {
		if	( this.UNZIPPED ) return this.UNZIPPED
		this._unzipPromise || (
			this._unzipPromise = unzip(
				this.FETCHED
			,	iconFilter
			).then(
				icons => {
					this.UNZIPPED = icons
					return icons
				}
			,	er => {
					this._unzipPromise = null
					throw er
				}
			)
		)
		return	this._unzipPromise
	}

	async	BuildICONs( root ) {
		const
		showPNG = RoleE( this, 'PNG' ).checked
	,	showSVG = RoleE( this, 'SVG' ).checked
		if	( !( showPNG || showSVG ) ) {
			clearIcons( root )
			AE( root, 'p' ).textContent = 'Check SVG and/or PNG.'
			return
		}

		const
		gen = ++this._buildGen
		clearIcons( root )
		const
		status = root.appendChild( SPINNER( this ) )

		try {
			//	let the browser paint the spinner before the ( possibly
			//	microtask-only, cached ) fetch + unzip work runs
			await new Promise( requestAnimationFrame )
			if	( gen !== this._buildGen || !root.open ) return

			await this.fetchZip()
			if	( gen !== this._buildGen || !root.open ) return

			const
			icons = await this.unzipIcons()
			if	( gen !== this._buildGen || !root.open ) return

			//	group the flat path list into a folder tree first ( cheap )
			let
			shown = 0
			const
			tree = { dirs: new Map(), files: [] }
			for ( const [ path, bytes ] of Object.entries( icons ) ) {
				if	( path.endsWith( '.png' ) && !showPNG ) continue
				if	( path.endsWith( '.svg' ) && !showSVG ) continue
				const
				parts = path.split( '/' )
				,	name = parts.pop()
				let
				node = tree
				for ( const dir of parts ) {
					node.dirs.has( dir ) || node.dirs.set( dir, { dirs: new Map(), files: [] } )
					node = node.dirs.get( dir )
				}
				node.files.push( { name, path, bytes } )
				shown++
			}

			renderFolder( root, tree )

			if	( !shown ) {
				AE( root, 'p' ).textContent = 'Check SVG and/or PNG.'
			}
		} catch ( er ) {
			if	( gen === this._buildGen ) {
				AE( root, 'p' ).textContent = String( er )
			}
			throw er
		} finally {
			status.remove()
		}
	}
}

customElements.define( 'cloud-icons', CloudIcons )
