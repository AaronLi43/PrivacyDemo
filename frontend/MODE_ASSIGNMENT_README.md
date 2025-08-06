# Mode Assignment System

This directory now contains separate HTML files for each study mode and a redirect system for random assignment.

## Files Overview

### Redirect System
- **`redirect.html`** - Main entry point that randomly assigns users to one of three modes

### Mode-Specific Files
- **`naive.html`** - Naive mode interface (😊)
- **`neutral.html`** - Neutral mode interface (⚖️)  
- **`featured.html`** - Featured mode interface (🔒)

## How It Works

### For Users
1. Users visit `redirect.html`
2. The page randomly selects one of the three modes
3. After a 2-second delay showing the selected mode, users are redirected to the appropriate HTML file
4. All URL parameters (like `PROLIFIC_PID`) are preserved during the redirect
5. An `assigned_mode` parameter is added to track which mode was assigned

### For Researchers
- **Entry Point**: Direct users to `redirect.html` instead of `index.html`
- **Random Assignment**: Each user gets randomly assigned to one mode
- **Parameter Preservation**: All existing URL parameters are maintained
- **Mode Tracking**: The `assigned_mode` parameter indicates which mode was assigned

## Mode Differences

### Naive Mode (😊)
- Basic editing capabilities
- Simple interface
- Focus on conversation editing before export

### Neutral Mode (⚖️)
- Standard conversation interface
- No special privacy features
- Baseline experience

### Featured Mode (🔒)
- Enhanced privacy features
- Advanced editing capabilities
- Privacy analysis tools
- Comprehensive privacy controls

## Technical Details

### Random Assignment
- Uses JavaScript `Math.random()` for unbiased selection
- Equal probability (33.33%) for each mode
- Assignment happens immediately when page loads

### URL Parameter Handling
- Preserves all existing query parameters
- Adds `assigned_mode` parameter for tracking
- Maintains compatibility with existing systems

### Mode-Specific Features
- Each HTML file has the mode hardcoded
- Removes mode selection dropdown
- Updates UI text and survey questions accordingly
- Maintains all existing functionality

## Usage Examples

### Basic Usage
```
https://your-domain.com/frontend/redirect.html
```

### With Prolific ID
```
https://your-domain.com/frontend/redirect.html?PROLIFIC_PID=abc123
```

### Resulting URLs
After redirect, users will be sent to one of:
- `naive.html?PROLIFIC_PID=abc123&assigned_mode=naive`
- `neutral.html?PROLIFIC_PID=abc123&assigned_mode=neutral`
- `featured.html?PROLIFIC_PID=abc123&assigned_mode=featured`

## Implementation Notes

- All mode-specific files use the same `script.js` and `styles.css`
- Mode is set via JavaScript after page load
- Survey questions are customized for each mode
- UI text and instructions are mode-appropriate
- All existing functionality is preserved

## Backward Compatibility

- Original `index.html` still works with manual mode selection
- All existing features and functionality remain unchanged
- New system is additive, not replacing existing functionality 