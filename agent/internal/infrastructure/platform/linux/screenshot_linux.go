//go:build linux

package linux

import (
	"bytes"
	"fmt"
	"image/png"
	"os/exec"

	"github.com/tracker/agent/pkg/jpegcompress"
)

type ScreenshotCapturer struct{}

func NewScreenshotCapturer() *ScreenshotCapturer {
	return &ScreenshotCapturer{}
}

// Capture shells out to ImageMagick's `import` to grab the root window as
// PNG on stdout, then downscales/re-encodes it as JPEG via jpegcompress.
func (c *ScreenshotCapturer) Capture(quality int) ([]byte, error) {
	cmd := exec.Command("import", "-silent", "-window", "root", "png:-")
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("capture screenshot via `import`: %w", err)
	}

	img, err := png.Decode(&stdout)
	if err != nil {
		return nil, fmt.Errorf("decode captured png: %w", err)
	}

	return jpegcompress.Encode(img, quality)
}
