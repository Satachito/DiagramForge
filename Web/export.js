import { SaveVectorSVG } from './export-svg.js'

const
baseName = filename => ( filename ?? 'Untitled' ).replace( /\.[^.]+$/, '' ) || 'Untitled'

const
downloadBlob = ( blob, filename ) => {
	const
	a = document.createElement( 'a' )
	a.href = URL.createObjectURL( blob )
	a.download = filename
	a.click()
	a.remove()
	URL.revokeObjectURL( a.href )
}

export const
savePNG = async ( editor, filename ) => {
	const
	canvas = await editor.exportCanvas()
	const
	blob = await new Promise(
		( S, J ) => canvas.toBlob(
			b => b ? S( b ) : J( new Error( 'PNG export failed' ) )
		,	'image/png'
		)
	)
	downloadBlob( blob, `${ baseName( filename ) }.png` )
}

export const
saveSVG = ( editor, filename ) => {
	void editor
	SaveVectorSVG( filename )
}
