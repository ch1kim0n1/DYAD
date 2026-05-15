# LLM Extraction Prompt for L2 Features

You are an expert in relationship psychology and linguistic analysis. Analyze the following message and extract the specified features according to the Gottman Institute's research framework.

## Input Message
```
{{message_text}}
```

## Context
- Is from me: {{is_from_me}}
- Timestamp: {{timestamp}}

## Task
Extract the following features from the message and return a JSON response:

### 1. Bid Classification
- **is_bid**: Does this message attempt to connect with the partner? (true/false)
- **bid_type**: If a bid, classify the type: 'observation', 'question', 'share', 'request', or null
- **confidence**: Your confidence in this classification (0-1)

### 2. Response Classification
- **is_response_to_bid**: Is this message responding to a previous bid? (true/false)
- **quality**: If responding, classify quality: 'engaged', 'perfunctory', 'missed', 'hostile', or null
- **confidence**: Your confidence in this classification (0-1)

### 3. Horseman Markers (Gottman's Four Horsemen)
- **criticism**: Does this message attack the partner's character? (true/false)
- **contempt**: Does this message show disrespect or mockery? (true/false)
- **defensiveness**: Does this message defend against perceived attack? (true/false)
- **stonewalling**: Does this message withdraw or refuse to engage? (true/false)

### 4. Validation Markers
- **acknowledges**: Does this message acknowledge the partner's perspective? (true/false)
- **paraphrases**: Does this message paraphrase or reflect back? (true/false)
- **asks_to_understand**: Does this message ask for clarification or understanding? (true/false)

### 5. Emotion Label
- **label**: Primary emotion: 'joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'
- **intensity**: Emotion intensity: 'low', 'med', 'high'
- **confidence**: Your confidence in this classification (0-1)

### 6. Secondary Emotion Inference (if applicable)
- **surface**: The surface emotion expressed
- **underneath**: The underlying emotion: 'hurt', 'fear', 'shame', 'loneliness'
- **confidence**: Your confidence in this inference (0-1)
- **null** if not applicable

### 7. Action Identification Level
- **action_id_level**: Is this message low-level action identification (specific) or high-level (abstract)? 'low' or 'high'

### 8. Higgins Family (Motivational)
- **higgins_family**: 'dejection', 'agitation', 'neutral', or null based on prevention vs promotion focus

### 9. Topic Tags
- **topic_tags**: Array of topic strings (e.g., ['work', 'family', 'finances'])

### 10. Latency Z-Score
- **latency_z_score**: Normalized response time deviation (provided separately, set to 0 if not available)

### 11. Clinical Flag (if applicable)
- **category**: 'abuse', 'suicidality', 'severe_depression', or null
- **confidence**: Your confidence in this flag (0-1)
- **null** if not applicable

## Output Format
Return only valid JSON with this exact structure:
```json
{
  "bid_classification": {
    "is_bid": boolean,
    "bid_type": "observation" | "question" | "share" | "request" | null,
    "confidence": number
  },
  "response_classification": {
    "is_response_to_bid": boolean,
    "quality": "engaged" | "perfunctory" | "missed" | "hostile" | null,
    "confidence": number
  },
  "horseman_markers": {
    "criticism": boolean,
    "contempt": boolean,
    "defensiveness": boolean,
    "stonewalling": boolean
  },
  "validation_markers": {
    "acknowledges": boolean,
    "paraphrases": boolean,
    "asks_to_understand": boolean
  },
  "primary_emotion": {
    "label": "joy" | "trust" | "fear" | "surprise" | "sadness" | "disgust" | "anger" | "anticipation",
    "intensity": "low" | "med" | "high",
    "confidence": number
  },
  "secondary_emotion_inference": {
    "surface": string,
    "underneath": "hurt" | "fear" | "shame" | "loneliness",
    "confidence": number
  } | null,
  "action_id_level": "low" | "high",
  "higgins_family": "dejection" | "agitation" | "neutral" | null,
  "topic_tags": string[],
  "latency_z_score": number,
  "clinical_flag": {
    "category": "abuse" | "suicidality" | "severe_depression" | null,
    "confidence": number
  } | null
}
```

## Guidelines
- Be precise and base your analysis on linguistic cues
- Consider context and tone
- Use confidence scores to indicate uncertainty
- For clinical flags, err on the side of caution and flag potential issues
- If any field is truly inapplicable, use null
