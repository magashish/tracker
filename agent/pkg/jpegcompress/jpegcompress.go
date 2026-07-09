// Package jpegcompress downscales and JPEG-encodes a captured screenshot.
// It has no side effects and no OS dependencies, so it is reused by every
// platform's ScreenshotCapturer implementation.
package jpegcompress

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"

	"golang.org/x/image/draw"
)

// MaxDimension bounds the long edge of the encoded image (default 1600px
// per docs/architecture/05-desktop-agent-architecture.md §5.7) to keep
// both CPU and upload size down.
const MaxDimension = 1600

// Encode downscales img (if needed) and JPEG-encodes it at the given
// quality (1-100, clamped).
func Encode(img image.Image, quality int) ([]byte, error) {
	if quality < 1 {
		quality = 1
	}
	if quality > 100 {
		quality = 100
	}

	bounds := img.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width > MaxDimension || height > MaxDimension {
		scale := float64(MaxDimension) / float64(max(width, height))
		newWidth := int(float64(width) * scale)
		newHeight := int(float64(height) * scale)
		scaled := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
		draw.CatmullRom.Scale(scaled, scaled.Bounds(), img, bounds, draw.Over, nil)
		img = scaled
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, fmt.Errorf("encode jpeg: %w", err)
	}
	return buf.Bytes(), nil
}
