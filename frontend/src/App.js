import React, { useState, useRef, useEffect } from 'react';
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
  Popover,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Stack,
  Checkbox,
  Divider,
  LinearProgress,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
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
  const [currentPage, setCurrentPage] = useState(0); // 0: upload, 1: text input, 2: multiple choice
  const [questionnaire, setQuestionnaire] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [fixedText, setFixedText] = useState(new Set());
  const [ignoredText, setIgnoredText] = useState(new Set());
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [otherInput, setOtherInput] = useState('');
  const [otherResult, setOtherResult] = useState(null);
  const [analyzedOptions, setAnalyzedOptions] = useState(false);
  const [optionResults, setOptionResults] = useState({});
  const [fixedOptions, setFixedOptions] = useState(new Set());
  const [ignoredOptions, setIgnoredOptions] = useState(new Set());
  const [optionAnchorEl, setOptionAnchorEl] = useState(null);
  const [selectedOptionSuggestion, setSelectedOptionSuggestion] = useState(null);
  const [analyzingOptions, setAnalyzingOptions] = useState(false);
  const [showOptionSuggestions, setShowOptionSuggestions] = useState(false);
  const [skippedQuestions, setSkippedQuestions] = useState(new Set());
  const fileInputRef = useRef(null);
  const textFieldRef = useRef(null);
  const [popupAnchorEl, setPopupAnchorEl] = useState(null);
  const [intermediateResults, setIntermediateResults] = useState({});
  const [intermediateInputs, setIntermediateInputs] = useState({});
  const [answerIndicators, setAnswerIndicators] = useState({});
  const [optionSuggestions, setOptionSuggestions] = useState([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          setQuestionnaire(data);
          setCurrentPage(1);
          setCurrentQuestionIndex(0);
          setAnswers({});
          loadCurrentQuestion();
        } catch (error) {
          setError('Invalid JSON file format');
        }
      };
      reader.readAsText(file);
    }
  };

  const loadCurrentQuestion = () => {
    if (!questionnaire) return;
    
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    // Get the saved answer for this question
    const savedAnswer = answers[currentQuestion.id];

    // Reset analysis states
    setResult(null);
    setError(null);
    setFixedText(new Set());
    setIgnoredText(new Set());
    setSelectedOptions([]);
    setOtherInput('');
    setOtherResult(null);
    setOptionResults({});
    setFixedOptions(new Set());
    setIgnoredOptions(new Set());
    setShowOptionSuggestions(false);
    setSelectedOptionSuggestion(null);
    setOptionAnchorEl(null);
    setInput('');

    // Update answer indicator
    if (savedAnswer) {
      setAnswerIndicators(prev => ({
        ...prev,
        [currentQuestion.id]: {
          hasAnswer: true,
          type: currentQuestion.type,
          text: savedAnswer.text,
          selected: savedAnswer.selected,
          other: savedAnswer.other,
          skipped: savedAnswer.skipped
        }
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/api/check-privacy', {
        content: input,
        type: 'text',
      });
      setResult(response.data);
      
      // Save the answer
      const currentQuestion = questionnaire.questions[currentQuestionIndex];
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          text: input,
          result: response.data,
          fixedText: Array.from(fixedText),
          ignoredText: Array.from(ignoredText)
        }
      }));

      // Update answer indicator with synthesized text if available
      setAnswerIndicators(prev => ({
        ...prev,
        [currentQuestion.id]: {
          hasAnswer: true,
          type: 'text',
          text: input,
          originalText: input
        }
      }));
    } catch (err) {
      console.error('API Error:', err);
      setError(err.response?.data?.detail || 'Failed to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    // Save the current state before skipping
    const skippedState = {
      text: input,
      result: result,
      fixedText: Array.from(fixedText),
      ignoredText: Array.from(ignoredText),
      skipped: true
    };

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: skippedState
    }));

    // Update answer indicator
    setAnswerIndicators(prev => ({
      ...prev,
      [currentQuestion.id]: {
        hasAnswer: true,
        type: currentQuestion.type,
        skipped: true
      }
    }));

    setSkippedQuestions(prev => new Set([...prev, currentQuestion.id]));
    handleNext();
  };

  const handleNext = () => {
    if (currentQuestionIndex < questionnaire.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      loadCurrentQuestion();
    } else {
      setCurrentPage(2); // Move to results page
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      loadCurrentQuestion();
    } else {
      setCurrentPage(0); // Move to upload page
    }
  };

  const handleMultipleChoiceSubmit = async () => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    
    // If no options selected, just move to next question
    if (selectedOptions.length === 0) {
      handleNext();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/analyze', {
        text: selectedOptions.join(', ') + (otherInput ? `, ${otherInput}` : '')
      });

      if (response.data.sensitive_parts.length > 0) {
        setOptionSuggestions(response.data.sensitive_parts);
        setShowOptionSuggestions(true);
      } else {
        // If no sensitive parts, save answer and move to next
        const answer = {
          question_id: currentQuestion.id,
          selected: selectedOptions,
          other: otherInput || null,
          otherResult: otherResult,
          fixedOptions: Array.from(fixedOptions),
          ignoredOptions: Array.from(ignoredOptions),
          optionResults: optionResults
        };

        setAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: answer
        }));

        setAnswerIndicators(prev => ({
          ...prev,
          [currentQuestion.id]: {
            hasAnswer: true,
            type: 'multiple_choice',
            selected: selectedOptions,
            other: otherInput || null,
            originalSelected: selectedOptions,
            originalOther: otherInput || null
          }
        }));
        handleNext();
      }
    } catch (err) {
      console.error('Error:', err);
      // If backend is not available, proceed without analysis
      const answer = {
        question_id: currentQuestion.id,
        selected: selectedOptions,
        other: otherInput || null,
        otherResult: null,
        fixedOptions: [],
        ignoredOptions: [],
        optionResults: {}
      };

      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: answer
      }));

      setAnswerIndicators(prev => ({
        ...prev,
        [currentQuestion.id]: {
          hasAnswer: true,
          type: 'multiple_choice',
          selected: selectedOptions,
          other: otherInput || null,
          originalSelected: selectedOptions,
          originalOther: otherInput || null
        }
      }));
      handleNext();
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = {
      questionnaire: questionnaire,
      answers: answers,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questionnaire_answers.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSuggestionClick = (suggestion, event) => {
    setSelectedSuggestion(suggestion);
    setAnchorEl(event.currentTarget);
  };

  const handleSuggestionClose = () => {
    setAnchorEl(null);
    setSelectedSuggestion(null);
  };

  const applySuggestion = (suggestion) => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    const newText = input.replace(suggestion.text, suggestion.synthesized_text);
    setInput(newText);
    // Update answer indicator with synthesized text
    setAnswerIndicators(prev => ({
      ...prev,
      [currentQuestion.id]: {
        hasAnswer: true,
        type: 'text',
        text: newText,
        originalText: input
      }
    }));
    setFixedText(prev => new Set([...prev, suggestion.text]));
    setSelectedSuggestion(null);
    setPopupAnchorEl(null);
  };

  const renderHighlightedText = (text, sensitiveParts) => {
    if (!sensitiveParts || sensitiveParts.length === 0) return text;

    let result = [];
    let lastIndex = 0;

    sensitiveParts.forEach((part, index) => {
      // Add text before the sensitive part
      if (part.start_index > lastIndex) {
        result.push(text.slice(lastIndex, part.start_index));
      }

      // Add the sensitive part with appropriate styling
      const isFixed = fixedText.has(part.text);
      const style = {
        backgroundColor: isFixed ? '#e8f5e9' : '#ffcdd2',
        color: isFixed ? '#2e7d32' : '#d32f2f',
        padding: '2px 4px',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'inline-block',
      };

      result.push(
        <span
          key={index}
          style={style}
          onClick={(e) => !isFixed && handleSuggestionClick(part, e)}
        >
          {isFixed ? part.synthesized_text : part.text}
          {isFixed && <CheckCircleIcon style={{ fontSize: 16, marginLeft: 4 }} />}
        </span>
      );

      lastIndex = part.end_index;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  };

  const renderTextInputPage = () => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    return (
      <Box>
        {/* <Typography variant="h6" gutterBottom>
          {currentQuestion.question}
        </Typography> */}
        <form onSubmit={handleSubmit}>
          <TextField
            ref={textFieldRef}
            fullWidth
            multiline
            rows={6}
            variant="outlined"
            label="Your Answer"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            sx={{ mb: 2 }}
            required={currentQuestion.required}
            placeholder="Enter your answer here"
          />

          <Stack direction="row" spacing={2}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || (currentQuestion.required && !input.trim())}
            >
              {loading ? <CircularProgress size={24} /> : 'Analyze Privacy'}
            </Button>
            {!currentQuestion.required && (
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleSkip}
              >
                Skip
              </Button>
            )}
          </Stack>
        </form>

        {result && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Original Text (with sensitive information highlighted):
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                mb: 2,
                minHeight: '100px',
              }}
            >
              {renderHighlightedText(result.original_text, result.sensitive_parts)}
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              Synthesized Version:
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: '#e8f5e9',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography>{result.synthesized_text}</Typography>
              <IconButton
                onClick={() => navigator.clipboard.writeText(result.synthesized_text)}
                size="small"
              >
                <ContentCopyIcon />
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const renderUploadPage = () => (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Upload Questionnaire
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Please upload a JSON file containing your questionnaire
          </Typography>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current.click()}
            sx={{ mb: 2 }}
          >
            Choose File
          </Button>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      </Grid>
    </Grid>
  );

  const renderCompletionPage = () => (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Questionnaire Completed!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Thank you for completing the questionnaire. You can now export your answers.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleExport}
          >
            Export Answers
          </Button>
        </Paper>
      </Grid>
    </Grid>
  );

  const renderProgressBar = () => {
    if (!questionnaire) return null;
    
    const totalQuestions = questionnaire.questions.length;
    const answeredQuestions = Object.keys(answers).length;
    const skippedCount = skippedQuestions.size;
    const progress = ((answeredQuestions + skippedCount) / totalQuestions) * 100;

    return (
      <Box sx={{ width: '100%', mb: 3 }}>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            height: 10, 
            borderRadius: 5,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'primary.main',
            }
          }} 
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          {questionnaire.questions.map((_, index) => {
            const isAnswered = answers[questionnaire.questions[index].id];
            const isSkipped = skippedQuestions.has(index);
            const isCurrent = index === currentQuestionIndex;
            
            return (
              <Box
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: isCurrent 
                    ? 'primary.main' 
                    : isAnswered 
                      ? 'success.main' 
                      : isSkipped 
                        ? 'warning.main' 
                        : 'grey.300',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scale(1.2)',
                  }
                }}
              />
            );
          })}
        </Box>
      </Box>
    );
  };

  const renderQuestionIndicator = (questionId) => {
    const indicator = answerIndicators[questionId];
    if (!indicator) return null;

    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        color: indicator.skipped ? 'text.secondary' : 'success.main',
        fontSize: '0.875rem',
        mb: 1
      }}>
        {indicator.skipped ? (
          <>
            <CloseIcon fontSize="small" />
            <Typography variant="body2">Skipped</Typography>
          </>
        ) : (
          <>
            <CheckCircleIcon fontSize="small" />
            <Typography variant="body2">
              {indicator.type === 'text' 
                ? `Answered: ${indicator.text.substring(0, 1000)}${indicator.text.length > 1000 ? '...' : ''}`
                : `Selected: ${indicator.selected?.join(', ')}${indicator.other ? `, Other: ${indicator.other}` : ''}`
              }
            </Typography>
          </>
        )}
      </Box>
    );
  };

  const renderNavigationButtons = () => {
    return (
      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={handleNext}
        >
          {currentQuestionIndex === questionnaire.questions.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </Stack>
    );
  };

  const renderQuestionPage = () => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    
    return (
      <Grid container spacing={4}>
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  {currentQuestion.question}
                </Typography>
                {currentQuestion.required && (
                  <Typography variant="caption" color="text.secondary">
                    * Required
                  </Typography>
                )}
              </Box>
              {currentQuestion.type === 'multiple_choice' && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={analyzeOptions}
                  disabled={analyzingOptions}
                  startIcon={analyzingOptions ? <CircularProgress size={20} /> : null}
                >
                  {analyzingOptions ? 'Analyzing...' : 'Analyze Options Privacy'}
                </Button>
              )}
            </Box>

            {renderQuestionIndicator(currentQuestion.id)}

            {currentQuestion.type === 'text' ? (
              renderTextInputPage()
            ) : (
              <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
                <FormLabel component="legend">
                  {currentQuestion.allow_multiple ? 'Select all that apply:' : 'Select one option:'}
                </FormLabel>
                {currentQuestion.allow_multiple ? (
                  <Box>
                    {currentQuestion.options.map((option, index) => (
                      <FormControlLabel
                        key={index}
                        control={
                          <Checkbox
                            checked={selectedOptions.includes(option)}
                            onChange={(e) => handleOptionChange(e, option)}
                          />
                        }
                        label={renderOption(option)}
                      />
                    ))}
                  </Box>
                ) : (
                  <RadioGroup
                    value={selectedOptions[0] || ''}
                    onChange={(e) => handleOptionChange(e, e.target.value)}
                  >
                    {currentQuestion.options.map((option, index) => (
                      <FormControlLabel
                        key={index}
                        value={option}
                        control={<Radio />}
                        label={renderOption(option)}
                      />
                    ))}
                  </RadioGroup>
                )}
                {currentQuestion.options.includes('Other') && (
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      label="Other (please specify)"
                      value={otherInput}
                      onChange={(e) => setOtherInput(e.target.value)}
                      disabled={!selectedOptions.includes('Other')}
                    />
                    {selectedOptions.includes('Other') && otherInput && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={handleOtherSubmit}
                        sx={{ mt: 1 }}
                      >
                        Analyze Privacy
                      </Button>
                    )}
                  </Box>
                )}
              </FormControl>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={handleBack}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={currentQuestion.type === 'multiple_choice' ? handleMultipleChoiceSubmit : handleNext}
              >
                {currentQuestionIndex === questionnaire.questions.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const handleOptionChange = (e, option) => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    if (currentQuestion.allow_multiple) {
      // For multiple choice, toggle the option
      setSelectedOptions(prev => 
        e.target.checked 
          ? [...prev, option]
          : prev.filter(o => o !== option)
      );
    } else {
      // For single choice, replace the selection
      setSelectedOptions([option]);
    }
  };

  const handleOptionSuggestionClick = (option, suggestion, event) => {
    setSelectedOptionSuggestion({ option, suggestion });
    setOptionAnchorEl(event.currentTarget);
  };

  const handleOptionSuggestionClose = () => {
    setOptionAnchorEl(null);
    setSelectedOptionSuggestion(null);
  };

  const applyOptionSuggestion = (option, suggestion) => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    const newOption = option.replace(suggestion.text, suggestion.synthesized_text);
    
    // Update the selected options with the revised text
    const newSelectedOptions = selectedOptions.map(opt => 
      opt === option ? newOption : opt
    );
    setSelectedOptions(newSelectedOptions);

    // Update answer indicator with revised options
    setAnswerIndicators(prev => ({
      ...prev,
      [currentQuestion.id]: {
        hasAnswer: true,
        type: 'multiple_choice',
        selected: newSelectedOptions,
        other: otherInput || null,
        originalSelected: selectedOptions,
        originalOther: otherInput || null
      }
    }));

    setFixedOptions(prev => new Set([...prev, option]));
    setShowOptionSuggestions(false);
  };

  const ignoreOptionSuggestion = (option) => {
    setIgnoredOptions(prev => new Set([...prev, option]));
    setShowOptionSuggestions(false);
  };

  const toggleOptionSuggestion = (option) => {
    setShowOptionSuggestions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const analyzeOptions = async () => {
    const currentQuestion = questionnaire.questions[currentQuestionIndex];
    setAnalyzingOptions(true);
    setError(null);

    try {
      const results = {};
      for (const option of currentQuestion.options) {
        if (option === 'Other') continue;
        
        const response = await axios.post('http://localhost:8000/api/check-privacy', {
          content: option,
          type: 'text'
        });
        results[option] = response.data;
      }
      setOptionResults(results);
    } catch (err) {
      console.error('API Error:', err);
      setError(err.response?.data?.detail || 'Failed to analyze options. Please try again.');
    } finally {
      setAnalyzingOptions(false);
    }
  };

  const handleOtherSubmit = async () => {
    if (!otherInput.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/api/check-privacy', {
        content: otherInput,
        type: 'text',
      });
      
      if (response.data && response.data.sensitive_parts) {
        setOtherResult(response.data);
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('API Error:', err);
      setError(err.response?.data?.detail || 'Failed to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderOption = (option) => {
    if (!option) return null;

    const result = optionResults[option];
    const hasSensitiveInfo = result?.sensitive_parts?.length > 0;
    const isFixed = fixedOptions.has(option);
    const isIgnored = ignoredOptions.has(option);
    const isShowingSuggestion = showOptionSuggestions;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography
          sx={{
            color: isFixed && result?.synthesized_text ? 'success.main' : isIgnored ? 'text.disabled' : 'text.primary',
          }}
        >
          {isFixed && result?.synthesized_text ? result.synthesized_text : option}
        </Typography>
        {hasSensitiveInfo && !isFixed && !isIgnored && (
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={() => toggleOptionSuggestion(option)}
            sx={{ ml: 2 }}
          >
            {isShowingSuggestion ? 'Hide Suggestions' : 'Show Suggestions'}
          </Button>
        )}
        {isShowingSuggestion && hasSensitiveInfo && !isFixed && !isIgnored && result?.sensitive_parts?.[0] && (
          <Box
            sx={{
              position: 'absolute',
              left: '100%',
              ml: 2,
              bgcolor: 'background.paper',
              boxShadow: 3,
              borderRadius: 1,
              p: 2,
              minWidth: 300,
              zIndex: 1000,
            }}
          >
            <Typography variant="subtitle2" color="error" gutterBottom>
              Sensitive Information Detected
            </Typography>
            <Typography variant="body2" gutterBottom>
              Type: {result.sensitive_parts[0].type}
            </Typography>
            <Typography variant="body2" gutterBottom>
              Original: {option}
            </Typography>
            <Typography variant="body2" color="success.main" gutterBottom>
              Suggested: {result.synthesized_text || 'No suggestion available'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={() => applyOptionSuggestion(option, result.sensitive_parts[0])}
                disabled={!result.synthesized_text}
              >
                Apply
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                onClick={() => ignoreOptionSuggestion(option)}
              >
                Keep Original
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center">
            {questionnaire?.title || 'Privacy-Aware Data Collection'}
          </Typography>
          {questionnaire?.description && (
            <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 4 }}>
              {questionnaire.description}
            </Typography>
          )}

          {currentPage > 0 && currentPage < 3 && renderProgressBar()}
          
          {currentPage === 0 && renderUploadPage()}
          {currentPage > 0 && currentPage < 3 && renderQuestionPage()}
          {currentPage === 3 && renderCompletionPage()}

          {currentPage > 0 && currentPage < 3 && (
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
              >
                Back
              </Button>
              <Stack direction="row" spacing={2}>
                {!questionnaire.questions[currentQuestionIndex].required && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleSkip}
                  >
                    Skip
                  </Button>
                )}
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={currentQuestionIndex === questionnaire?.questions.length - 1 ? handleMultipleChoiceSubmit : handleNext}
                >
                  {currentQuestionIndex === questionnaire?.questions.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </Stack>
            </Box>
          )}
        </Box>
      </Container>

      <Popover
        open={Boolean(optionAnchorEl)}
        anchorEl={optionAnchorEl}
        onClose={handleOptionSuggestionClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        {selectedOptionSuggestion && (
          <List sx={{ width: 300, maxWidth: '100%' }}>
            <ListItem>
              <ListItemText
                primary="Sensitive Information Detected"
                secondary={selectedOptionSuggestion.suggestion.type}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Original Option"
                secondary={selectedOptionSuggestion.option}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Suggested Replacement"
                secondary={selectedOptionSuggestion.suggestion.synthesized_text}
              />
            </ListItem>
            <ListItem>
              <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={() => applyOptionSuggestion(
                    selectedOptionSuggestion.option,
                    selectedOptionSuggestion.suggestion
                  )}
                >
                  Apply
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  fullWidth
                  onClick={() => ignoreOptionSuggestion(selectedOptionSuggestion.option)}
                >
                  Ignore
                </Button>
              </Stack>
            </ListItem>
          </List>
        )}
      </Popover>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleSuggestionClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        {selectedSuggestion && (
          <List sx={{ width: 300, maxWidth: '100%' }}>
            <ListItem>
              <ListItemText
                primary="Sensitive Information Detected"
                secondary={selectedSuggestion.type}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Suggested Replacement"
                secondary={selectedSuggestion.synthesized_text}
              />
            </ListItem>
            <ListItem>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => applySuggestion(selectedSuggestion)}
              >
                Apply Suggestion
              </Button>
            </ListItem>
          </List>
        )}
      </Popover>
    </ThemeProvider>
  );
}

export default App; 