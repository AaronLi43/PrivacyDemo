import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import axios from 'axios';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState('text');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/api/check-privacy', {
        content: input,
        type: inputType,
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const highlightSensitiveText = (text, sensitiveParts) => {
    if (!sensitiveParts || sensitiveParts.length === 0) return text;

    let result = text;
    let offset = 0;

    sensitiveParts.forEach((part) => {
      const start = part.start_index + offset;
      const end = part.end_index + offset;
      const highlighted = `<span style="background-color: #ffcdd2; color: #d32f2f;">${part.text}</span>`;
      result = result.slice(0, start) + highlighted + result.slice(end);
      offset += highlighted.length - (end - start);
    });

    return result;
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center">
            Privacy-Aware Data Collection
          </Typography>
          
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3 }}>
                <form onSubmit={handleSubmit}>
                  <FormControl component="fieldset" sx={{ mb: 2 }}>
                    <FormLabel component="legend">Input Type</FormLabel>
                    <RadioGroup
                      row
                      value={inputType}
                      onChange={(e) => setInputType(e.target.value)}
                    >
                      <FormControlLabel value="text" control={<Radio />} label="Text Input" />
                      <FormControlLabel value="multiple_choice" control={<Radio />} label="Multiple Choice" />
                    </RadioGroup>
                  </FormControl>

                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    variant="outlined"
                    label="Enter your data"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    sx={{ mb: 2 }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={loading || !input.trim()}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Analyze Privacy'}
                  </Button>
                </form>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Results
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                {result && (
                  <>
                    <Typography variant="subtitle1" gutterBottom>
                      Original Text (with sensitive information highlighted):
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: '#f5f5f5',
                        borderRadius: 1,
                        mb: 2,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: highlightSensitiveText(result.original_text, result.sensitive_parts),
                      }}
                    />

                    <Typography variant="subtitle1" gutterBottom>
                      Synthesized Version:
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: '#e8f5e9',
                        borderRadius: 1,
                      }}
                    >
                      {result.synthesized_text}
                    </Box>
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App; 