// Package api implements domain.APIGateway over HTTPS + JWT against the
// Tracker backend described in docs/architecture/04-api-specification.md.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/tracker/agent/internal/domain"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

type envelope[T any] struct {
	Data T `json:"data"`
}

type apiError struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (c *Client) do(ctx context.Context, method, path, accessToken string, body any, out any) error {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiErr apiError
		_ = json.Unmarshal(respBody, &apiErr)
		if apiErr.Error.Message != "" {
			return fmt.Errorf("%s %s: %s (%s)", method, path, apiErr.Error.Message, apiErr.Error.Code)
		}
		return fmt.Errorf("%s %s: unexpected status %d", method, path, resp.StatusCode)
	}

	if out == nil || len(respBody) == 0 {
		return nil
	}
	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

func (c *Client) LoginEmployee(ctx context.Context, email, password string, device domain.Device) (domain.LoginResult, error) {
	reqBody := map[string]any{
		"email":        email,
		"password":     password,
		"deviceUuid":   device.DeviceUUID,
		"hostname":     device.Hostname,
		"os":           device.OS,
		"osVersion":    device.OSVersion,
		"agentVersion": device.AgentVersion,
	}
	var resp envelope[struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		ExpiresIn    int    `json:"expiresIn"`
		Employee     struct {
			ID       string `json:"id"`
			FullName string `json:"fullName"`
			Email    string `json:"email"`
		} `json:"employee"`
		Device struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"device"`
	}]
	if err := c.do(ctx, http.MethodPost, "/auth/employee/login", "", reqBody, &resp); err != nil {
		return domain.LoginResult{}, err
	}
	return domain.LoginResult{
		Tokens: domain.TokenPair{
			AccessToken:  resp.Data.AccessToken,
			RefreshToken: resp.Data.RefreshToken,
			ExpiresIn:    resp.Data.ExpiresIn,
		},
		Device: domain.Device{
			ID:           resp.Data.Device.ID,
			DeviceUUID:   device.DeviceUUID,
			Hostname:     device.Hostname,
			OS:           device.OS,
			OSVersion:    device.OSVersion,
			AgentVersion: device.AgentVersion,
		},
		Employee: domain.EmployeeIdentity{
			ID:       resp.Data.Employee.ID,
			FullName: resp.Data.Employee.FullName,
			Email:    resp.Data.Employee.Email,
		},
	}, nil
}

func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (domain.TokenPair, error) {
	reqBody := map[string]string{"refreshToken": refreshToken}
	var resp envelope[domain.TokenPair]
	if err := c.do(ctx, http.MethodPost, "/auth/employee/refresh", "", reqBody, &resp); err != nil {
		return domain.TokenPair{}, err
	}
	return resp.Data, nil
}

func (c *Client) StartSession(ctx context.Context, accessToken, deviceID string) (domain.Session, error) {
	reqBody := map[string]string{"deviceId": deviceID}
	var resp envelope[struct {
		SessionID string    `json:"sessionId"`
		StartedAt time.Time `json:"startedAt"`
	}]
	if err := c.do(ctx, http.MethodPost, "/sessions/start", accessToken, reqBody, &resp); err != nil {
		return domain.Session{}, err
	}
	return domain.Session{ID: resp.Data.SessionID, StartedAt: resp.Data.StartedAt}, nil
}

func (c *Client) EndSession(ctx context.Context, accessToken, sessionID, reason string) error {
	reqBody := map[string]string{"reason": reason}
	return c.do(ctx, http.MethodPost, "/sessions/"+sessionID+"/end", accessToken, reqBody, nil)
}

func (c *Client) Heartbeat(ctx context.Context, accessToken, sessionID string, input domain.HeartbeatInput) (domain.Config, error) {
	reqBody := map[string]any{
		"capturedAt":          input.CapturedAt.Format(time.RFC3339),
		"idleSeconds":         input.IdleSeconds,
		"systemUptimeSeconds": input.SystemUptimeSeconds,
		"activeApp":           input.ActiveApp,
		"activeWindowTitle":   input.ActiveWindowTitle,
	}
	var resp envelope[struct {
		Acknowledged bool `json:"acknowledged"`
		Config       struct {
			HeartbeatIntervalSeconds  int    `json:"heartbeatIntervalSeconds"`
			ScreenshotIntervalSeconds int    `json:"screenshotIntervalSeconds"`
			ScreenshotQuality         int    `json:"screenshotQuality"`
			IdleThresholdSeconds      int    `json:"idleThresholdSeconds"`
			APIURL                    string `json:"apiUrl"`
		} `json:"config"`
	}]
	if err := c.do(ctx, http.MethodPost, "/sessions/"+sessionID+"/heartbeat", accessToken, reqBody, &resp); err != nil {
		return domain.Config{}, err
	}
	return domain.Config{
		HeartbeatIntervalSeconds:  resp.Data.Config.HeartbeatIntervalSeconds,
		ScreenshotIntervalSeconds: resp.Data.Config.ScreenshotIntervalSeconds,
		ScreenshotQuality:         resp.Data.Config.ScreenshotQuality,
		IdleThresholdSeconds:      resp.Data.Config.IdleThresholdSeconds,
		APIURL:                    resp.Data.Config.APIURL,
	}, nil
}

func (c *Client) SubmitActivityBatch(ctx context.Context, accessToken, deviceID string, samples []domain.ActivitySample) (int, error) {
	type sampleDTO struct {
		SessionID     string `json:"sessionId"`
		WindowStart   string `json:"windowStart"`
		WindowEnd     string `json:"windowEnd"`
		AppName       string `json:"appName"`
		WindowTitle   string `json:"windowTitle"`
		ActiveSeconds int    `json:"activeSeconds"`
		IdleSeconds   int    `json:"idleSeconds"`
	}
	dtos := make([]sampleDTO, len(samples))
	for i, s := range samples {
		dtos[i] = sampleDTO{
			SessionID:     s.SessionID,
			WindowStart:   s.WindowStart.Format(time.RFC3339),
			WindowEnd:     s.WindowEnd.Format(time.RFC3339),
			AppName:       s.AppName,
			WindowTitle:   s.WindowTitle,
			ActiveSeconds: s.ActiveSeconds,
			IdleSeconds:   s.IdleSeconds,
		}
	}
	reqBody := map[string]any{"samples": dtos}
	var resp envelope[struct {
		Accepted int `json:"accepted"`
	}]
	if err := c.do(ctx, http.MethodPost, "/activity/batch", accessToken, reqBody, &resp); err != nil {
		return 0, err
	}
	return resp.Data.Accepted, nil
}

func (c *Client) RequestScreenshotUploadURL(ctx context.Context, accessToken string, req domain.UploadURLRequest) (domain.UploadURLResponse, error) {
	reqBody := map[string]any{
		"sessionId":       req.SessionID,
		"capturedAt":      req.CapturedAt.Format(time.RFC3339),
		"activityPercent": req.ActivityPercent,
		"appName":         req.AppName,
		"windowTitle":     req.WindowTitle,
		"fileSizeBytes":   req.FileSizeBytes,
	}
	var resp envelope[struct {
		ScreenshotID string `json:"screenshotId"`
		UploadURL    string `json:"uploadUrl"`
		StorageKey   string `json:"storageKey"`
		ExpiresIn    int    `json:"expiresIn"`
	}]
	if err := c.do(ctx, http.MethodPost, "/screenshots/upload-url", accessToken, reqBody, &resp); err != nil {
		return domain.UploadURLResponse{}, err
	}
	return domain.UploadURLResponse{
		ScreenshotID: resp.Data.ScreenshotID,
		UploadURL:    resp.Data.UploadURL,
		StorageKey:   resp.Data.StorageKey,
		ExpiresIn:    resp.Data.ExpiresIn,
	}, nil
}

// UploadScreenshot PUTs directly to the signed upload URL returned above —
// not to the JSON API — so it bypasses c.do's JSON envelope handling.
func (c *Client) UploadScreenshot(ctx context.Context, uploadURL string, jpegBytes []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, bytes.NewReader(jpegBytes))
	if err != nil {
		return fmt.Errorf("build upload request: %w", err)
	}
	req.Header.Set("Content-Type", "image/jpeg")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("upload screenshot: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("upload screenshot: unexpected status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) ConfirmScreenshot(ctx context.Context, accessToken, screenshotID string) error {
	return c.do(ctx, http.MethodPost, "/screenshots/"+screenshotID+"/confirm", accessToken, nil, nil)
}

func (c *Client) LatestVersion(ctx context.Context, platform string) (domain.VersionInfo, error) {
	var resp envelope[struct {
		Version        string `json:"version"`
		DownloadURL    string `json:"downloadUrl"`
		ChecksumSHA256 string `json:"checksumSha256"`
		IsMandatory    bool   `json:"isMandatory"`
	}]
	if err := c.do(ctx, http.MethodGet, "/version/latest?platform="+platform, "", nil, &resp); err != nil {
		return domain.VersionInfo{}, err
	}
	return domain.VersionInfo{
		Version:        resp.Data.Version,
		DownloadURL:    resp.Data.DownloadURL,
		ChecksumSHA256: resp.Data.ChecksumSHA256,
		IsMandatory:    resp.Data.IsMandatory,
	}, nil
}
