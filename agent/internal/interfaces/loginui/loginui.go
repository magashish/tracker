// Package loginui is the agent's only user-facing surface (per the "no
// GUI except login screen" requirement): it prompts for the employee's
// email/password once, then the agent detaches into background tracking.
//
// This implementation is a terminal prompt rather than a native window.
// Building a real native window (Fyne, Walk, or a bare webview) needs
// platform GUI toolkit dependencies (OpenGL/X11 headers on Linux, a
// WebView2 runtime on Windows) that don't belong in a headless build
// environment; swapping in a native window means implementing the same
// Prompter interface with a windowed adapter — nothing above this
// package (the AuthUseCase, the scheduler) needs to change.
package loginui

import (
	"bufio"
	"fmt"
	"io"
	"strings"

	"golang.org/x/term"
)

type Credentials struct {
	Email    string
	Password string
}

type Prompter interface {
	PromptLogin() (Credentials, error)
	ShowError(message string)
}

type CLIPrompter struct {
	in  io.Reader
	out io.Writer
	// stdinFD is the file descriptor to use for hidden password input
	// (term.ReadPassword needs a real terminal fd, not an arbitrary reader).
	stdinFD int
}

func NewCLIPrompter(in io.Reader, out io.Writer, stdinFD int) *CLIPrompter {
	return &CLIPrompter{in: in, out: out, stdinFD: stdinFD}
}

func (p *CLIPrompter) PromptLogin() (Credentials, error) {
	reader := bufio.NewReader(p.in)

	fmt.Fprint(p.out, "Tracker Agent — sign in\nEmail: ")
	email, err := reader.ReadString('\n')
	if err != nil {
		return Credentials{}, fmt.Errorf("read email: %w", err)
	}

	var password string
	if term.IsTerminal(p.stdinFD) {
		fmt.Fprint(p.out, "Password: ")
		pw, err := term.ReadPassword(p.stdinFD)
		fmt.Fprintln(p.out)
		if err != nil {
			return Credentials{}, fmt.Errorf("read password: %w", err)
		}
		password = string(pw)
	} else {
		fmt.Fprint(p.out, "Password: ")
		pw, err := reader.ReadString('\n')
		if err != nil {
			return Credentials{}, fmt.Errorf("read password: %w", err)
		}
		password = strings.TrimRight(pw, "\r\n")
	}

	return Credentials{Email: strings.TrimSpace(email), Password: password}, nil
}

func (p *CLIPrompter) ShowError(message string) {
	fmt.Fprintf(p.out, "Sign-in failed: %s\n", message)
}
