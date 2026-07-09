//go:build windows

package windows

import (
	"fmt"
	"image"
	"unsafe"

	"golang.org/x/sys/windows"

	"github.com/tracker/agent/pkg/jpegcompress"
)

var (
	gdi32 = windows.NewLazySystemDLL("gdi32.dll")

	procGetDesktopWindow       = user32.NewProc("GetDesktopWindow")
	procGetDC                  = user32.NewProc("GetDC")
	procReleaseDC              = user32.NewProc("ReleaseDC")
	procGetSystemMetrics       = user32.NewProc("GetSystemMetrics")
	procCreateCompatibleDC     = gdi32.NewProc("CreateCompatibleDC")
	procCreateCompatibleBitmap = gdi32.NewProc("CreateCompatibleBitmap")
	procSelectObject           = gdi32.NewProc("SelectObject")
	procBitBlt                 = gdi32.NewProc("BitBlt")
	procGetDIBits              = gdi32.NewProc("GetDIBits")
	procDeleteDC               = gdi32.NewProc("DeleteDC")
	procDeleteObject           = gdi32.NewProc("DeleteObject")
)

const (
	smXVirtualScreen  = 76
	smYVirtualScreen  = 77
	smCXVirtualScreen = 78
	smCYVirtualScreen = 79
	srcCopy           = 0x00CC0020
	biRGB             = 0
	dibRGBColors      = 0
)

type bitmapInfoHeader struct {
	biSize          uint32
	biWidth         int32
	biHeight        int32
	biPlanes        uint16
	biBitCount      uint16
	biCompression   uint32
	biSizeImage     uint32
	biXPelsPerMeter int32
	biYPelsPerMeter int32
	biClrUsed       uint32
	biClrImportant  uint32
}

type ScreenshotCapturer struct{}

func NewScreenshotCapturer() *ScreenshotCapturer {
	return &ScreenshotCapturer{}
}

// Capture grabs the full virtual screen (all monitors) via GDI BitBlt,
// converts the DIB pixel buffer to image.RGBA, and hands off to
// jpegcompress for downscale+encode.
func (c *ScreenshotCapturer) Capture(quality int) ([]byte, error) {
	x, _, _ := procGetSystemMetrics.Call(smXVirtualScreen)
	y, _, _ := procGetSystemMetrics.Call(smYVirtualScreen)
	width, _, _ := procGetSystemMetrics.Call(smCXVirtualScreen)
	height, _, _ := procGetSystemMetrics.Call(smCYVirtualScreen)
	if width == 0 || height == 0 {
		return nil, fmt.Errorf("GetSystemMetrics returned zero screen size")
	}

	desktopWnd, _, _ := procGetDesktopWindow.Call()
	desktopDC, _, _ := procGetDC.Call(desktopWnd)
	if desktopDC == 0 {
		return nil, fmt.Errorf("GetDC failed")
	}
	defer procReleaseDC.Call(desktopWnd, desktopDC)

	memDC, _, _ := procCreateCompatibleDC.Call(desktopDC)
	if memDC == 0 {
		return nil, fmt.Errorf("CreateCompatibleDC failed")
	}
	defer procDeleteDC.Call(memDC)

	bitmap, _, _ := procCreateCompatibleBitmap.Call(desktopDC, width, height)
	if bitmap == 0 {
		return nil, fmt.Errorf("CreateCompatibleBitmap failed")
	}
	defer procDeleteObject.Call(bitmap)

	oldObj, _, _ := procSelectObject.Call(memDC, bitmap)
	defer procSelectObject.Call(memDC, oldObj)

	ret, _, _ := procBitBlt.Call(memDC, 0, 0, width, height, desktopDC, x, y, srcCopy)
	if ret == 0 {
		return nil, fmt.Errorf("BitBlt failed")
	}

	header := bitmapInfoHeader{
		biSize:        uint32(unsafe.Sizeof(bitmapInfoHeader{})),
		biWidth:       int32(width),
		biHeight:      -int32(height), // negative = top-down DIB, matches image.RGBA row order
		biPlanes:      1,
		biBitCount:    32,
		biCompression: biRGB,
	}

	pixels := make([]byte, width*height*4)
	ret, _, _ = procGetDIBits.Call(
		memDC, bitmap, 0, uintptr(height),
		uintptr(unsafe.Pointer(&pixels[0])),
		uintptr(unsafe.Pointer(&header)),
		dibRGBColors,
	)
	if ret == 0 {
		return nil, fmt.Errorf("GetDIBits failed")
	}

	img := bgraToRGBA(pixels, int(width), int(height))
	return jpegcompress.Encode(img, quality)
}

// bgraToRGBA converts a Windows BGRA (32bpp) DIB buffer to image.RGBA.
func bgraToRGBA(pixels []byte, width, height int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for i := 0; i < width*height; i++ {
		b, g, r, a := pixels[i*4], pixels[i*4+1], pixels[i*4+2], pixels[i*4+3]
		img.Pix[i*4], img.Pix[i*4+1], img.Pix[i*4+2], img.Pix[i*4+3] = r, g, b, a
	}
	return img
}
