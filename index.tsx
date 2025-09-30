// FIX: Import React and ReactDOM to resolve 'Cannot find name' errors.
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// --- Firebase Imports (Modern SDK) ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

const { useState, useEffect, useRef } = React;

// --- Firebase Configuration ---
// IMPORTAN: Firebase 프로젝트를 생성하고 아래에 설정을 붙여넣으세요.
// 1. https://firebase.google.com/ 로 이동하여 프로젝트를 생성합니다.
// 2. '빌드' -> 'Realtime Database'로 이동하여 데이터베이스를 생성합니다 (보안 규칙은 '테스트 모드에서 시작' 선택).
// 3. 프로젝트 설정(좌측 상단 톱니바퀴) > 일반 탭에서 아래로 스크롤하여 '내 앱' 섹션의 '</>' 아이콘을 클릭해 웹 앱을 등록합니다.
// 4. 'SDK 설정 및 구성'에서 '구성'을 선택하고, 나타나는 설정 객체를 복사하여 아래에 붙여넣습니다.
const firebaseConfig = {
  apiKey: "AIzaSyDxaWIl2IVH6Ozoclkjd5BfM8_AHieEzls",
  authDomain: "mnc-communicator.firebaseapp.com",
  databaseURL: "https://mnc-communicator-default-rtdb.firebaseio.com", // Add your databaseURL
  projectId: "mnc-communicator",
  storageBucket: "mnc-communicator.firebasestorage.app",
  messagingSenderId: "333912152053",
  appId: "1:333912152053:web:36750fb32a37406c1fb2bc",
  measurementId: "G-VDX5YN0E7S"
};


// --- Firebase Initialization ---
let database: any;
// FIX: The check incorrectly treated the actual API key as a placeholder, causing it to always be false.
// This is now corrected to only check for an empty or generic placeholder key.
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isFirebaseConfigured) {
    try {
        const app = initializeApp(firebaseConfig);
        database = getDatabase(app);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        alert("Firebase configuration is incorrect. Please check the code.");
    }
} else {
    console.warn("Firebase configuration is needed. Please fill in the firebaseConfig object in 'index.tsx'.");
}

// --- Type Definitions ---
type DisplayMode = 'timer' | 'message' | 'mixed' | 'image';
type ImageFit = 'contain' | 'width';

interface Styles {
  backgroundColor: string;
  fontFamily: string;
  timer: {
    color: string;
    fontSizes: {
      timer: number;
      mixed: number;
    };
  };
  message: {
    color: string;
    fontSize: number;
  };
  image: {
    fit: ImageFit;
  };
}

interface ImagePreset {
  name: string;
  dataUrl: string;
  fit: ImageFit;
}

interface ConfigSettings {
  styles: Styles;
  presetMessages: string[];
  imagePresets: ImagePreset[];
}

interface SavedConfig {
  name: string;
  settings: ConfigSettings;
}

interface ContentState {
    displayMode: DisplayMode;
    message: string;
    isBlinking: boolean;
    imageSrc: string;
    imageFit: ImageFit;
}

interface TimerState {
    timeRemaining: number;
    isRunning: boolean;
    initialTime: number;
    lastUpdatedTimestamp?: number;
}


// --- Initial Constants ---
const INITIAL_PRESET_MESSAGES: string[] = [
  "5분 남았습니다 (5 mins left)",
  "마무리 부탁드립니다 (Please wrap up)",
  "Q&A 시간입니다 (Q&A Time)",
];

const INITIAL_FONTS: string[] = [
  "Arial, sans-serif",
  "'Roboto Mono', monospace",
  "'Courier New', Courier, monospace",
  "'Times New Roman', Times, serif",
  "'Noto Sans KR', sans-serif"
];

// --- Helper Functions ---
const formatTime = (totalSeconds: number): string => {
  if (totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  return `${paddedMinutes}:${paddedSeconds}`;
};

// --- Components ---

interface SettingsModalProps {
    initialStyles: Styles;
    onSave: (newStyles: Styles) => void;
    onClose: () => void;
    fonts: string[];
    currentDisplayMode: DisplayMode;
    isModerator: boolean;
}

const SettingsModal = ({ initialStyles, onSave, onClose, fonts, currentDisplayMode, isModerator }: SettingsModalProps) => {
  const [localStyles, setLocalStyles] = useState<Styles>(initialStyles);
  
  const REFERENCE_WIDTH = 1920; // Reference for px <=> vw conversion

  // Get current timer vw size for the active mode
  const currentTimerVw = localStyles.timer.fontSizes[currentDisplayMode === 'timer' ? 'timer' : 'mixed'];
  
  const [pxValues, setPxValues] = useState({
    message: Math.round((initialStyles.message.fontSize / 100) * REFERENCE_WIDTH),
    timer: Math.round((currentTimerVw / 100) * REFERENCE_WIDTH),
  });

  // Effect to sync px value if style changes from outside while modal is open (e.g. mode change)
  useEffect(() => {
    const newTimerVw = localStyles.timer.fontSizes[currentDisplayMode === 'timer' ? 'timer' : 'mixed'];
    setPxValues(prev => ({ ...prev, timer: Math.round((newTimerVw / 100) * REFERENCE_WIDTH) }));
  }, [currentDisplayMode, localStyles.timer.fontSizes]);


  const handleStyleChange = (group: keyof Styles | 'message' | 'timer' | 'image' | null, prop: string, value: string, isNested = true) => {
    if (isNested && group) {
        // FIX: Spread types may only be created from object types.
        // The original code could attempt to spread properties that might be strings (like backgroundColor),
        // causing a type error. This check ensures we only perform a nested update on properties that are objects.
        if (group === 'timer' || group === 'message' || group === 'image') {
            setLocalStyles(prev => ({ ...prev, [group]: { ...prev[group], [prop]: value } }));
        }
    } else {
        setLocalStyles(prev => ({ ...prev, [prop]: value } as Pick<Styles, keyof Styles>));
    }
  };

  const handleTimerFontSizeChange = (vwValue: number) => {
    // Only update the font size for the current display mode
    const keyToUpdate = currentDisplayMode === 'timer' ? 'timer' : 'mixed';
    setLocalStyles(prev => ({
      ...prev,
      timer: {
        ...prev.timer,
        fontSizes: {
          ...prev.timer.fontSizes,
          [keyToUpdate]: vwValue,
        }
      }
    }));
  };
  
  const handlePxInputChange = (group: 'message' | 'timer', pxStringValue: string) => {
    setPxValues(prev => ({...prev, [group]: pxStringValue}));

    const parsedValue = parseInt(pxStringValue, 10);
    if (!isNaN(parsedValue)) {
      let vwValue = (parsedValue / REFERENCE_WIDTH) * 100;
      if (group === 'timer') {
        handleTimerFontSizeChange(vwValue);
      } else {
        handleStyleChange('message', 'fontSize', `${vwValue}`);
      }
    }
  };

  const handleSliderChange = (group: 'message' | 'timer', vwStringValue: string) => {
    const vwValue = parseFloat(vwStringValue);
    if (group === 'timer') {
      handleTimerFontSizeChange(vwValue);
    } else {
      handleStyleChange('message', 'fontSize', `${vwValue}`);
    }
    setPxValues(prev => ({...prev, [group]: Math.round((vwValue / 100) * REFERENCE_WIDTH)}));
  };

  const handleSave = () => {
    onSave(localStyles);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-preview-pane">
            <h3>미리보기</h3>
            <div className="modal-preview" style={{ backgroundColor: localStyles.backgroundColor, fontFamily: localStyles.fontFamily }}>
                <span className="modal-preview-text" style={{ ...localStyles.message, fontSize: `${localStyles.message.fontSize}cqw` }}>
                    Message
                </span>
                <span className="modal-preview-text" style={{ color: localStyles.timer.color, fontSize: `${currentTimerVw}cqw` }}>
                    12:34
                </span>
            </div>
        </div>

        <div className="modal-settings-pane">
            <h3>스타일 상세 설정</h3>
            <div className="modal-controls">
               <fieldset>
                    <legend>공통 설정</legend>
                     <div className="control-row">
                        <label htmlFor="bg-color">배경 색상</label>
                        <input id="bg-color" type="color" value={localStyles.backgroundColor} onChange={(e) => handleStyleChange(null, 'backgroundColor', e.target.value, false)} />
                    </div>
                    <div className="control-row">
                        <label htmlFor="font-family">폰트</label>
                        <select id="font-family" value={localStyles.fontFamily} onChange={(e) => handleStyleChange(null, 'fontFamily', e.target.value, false)}>
                            {fonts.map(font => <option key={font} value={font}>{font.split(',')[0].replace(/'/g, '')}</option>)}
                        </select>
                    </div>
               </fieldset>
               
               <fieldset>
                    <legend>메시지 스타일</legend>
                    <div className="control-row">
                        <label htmlFor="message-font-color">글자 색상</label>
                        <input id="message-font-color" type="color" value={localStyles.message.color} onChange={(e) => handleStyleChange('message', 'color', e.target.value)} />
                    </div>
                    <div className="control-row">
                        <label htmlFor="message-font-size-slider">글자 크기</label>
                         <div className="font-size-control">
                            <input id="message-font-size-slider" type="range" min="2" max="52" step="0.5" value={localStyles.message.fontSize} onChange={(e) => handleSliderChange('message', e.target.value)} />
                            <input id="message-font-size-px" className="px-input" type="number" value={pxValues.message} onChange={(e) => handlePxInputChange('message', e.target.value)} />
                            <span>px</span>
                        </div>
                    </div>
               </fieldset>
               
               {!isModerator && (
                 <fieldset>
                      <legend>타이머 스타일</legend>
                       <div className="control-row">
                          <label htmlFor="timer-font-color">글자 색상</label>
                          <input id="timer-font-color" type="color" value={localStyles.timer.color} onChange={(e) => handleStyleChange('timer', 'color', e.target.value)} />
                      </div>
                      <div className="control-row">
                          <label htmlFor="timer-font-size-slider">글자 크기</label>
                          <div className="font-size-control">
                              <input id="timer-font-size-slider" type="range" min="2" max="52" step="0.5" value={currentTimerVw} onChange={(e) => handleSliderChange('timer', e.target.value)} />
                              <input id="timer-font-size-px" className="px-input" type="number" value={pxValues.timer} onChange={(e) => handlePxInputChange('timer', e.target.value)} />
                              <span>px</span>
                          </div>
                      </div>
                 </fieldset>
               )}

               {isModerator && (
                <fieldset>
                  <legend>이미지 스타일</legend>
                  <div className="control-row">
                      <label>기본 이미지 맞춤</label>
                      <div className="image-fit-options">
                        <label>
                            <input type="radio" name="imageFitDefault" value="contain"
                                  checked={localStyles.image?.fit === 'contain'}
                                  onChange={(e) => handleStyleChange('image', 'fit', e.target.value)} />
                            <span>한 화면에 보이기</span>
                        </label>
                        <label>
                            <input type="radio" name="imageFitDefault" value="width"
                                  checked={localStyles.image?.fit === 'width'}
                                  onChange={(e) => handleStyleChange('image', 'fit', e.target.value)} />
                            <span>가로 폭 맞춤</span>
                        </label>
                      </div>
                  </div>
                </fieldset>
               )}
            </div>

            <div className="modal-actions">
              <button onClick={onClose}>취소</button>
              <button className="primary" onClick={handleSave}>저장</button>
            </div>
        </div>
      </div>
    </div>
  );
};


interface ConsolePanelProps {
    onSetTime: (minutes: number, seconds: number) => void;
    onStartPause: () => void;
    onReset: () => void;
    onSendMessage: (message: string) => void;
    onOpenSettings: () => void;
    isRunning: boolean;
    initialTime: number;
    displayMode: DisplayMode;
    onSetDisplayMode: (mode: DisplayMode) => void;
    presetMessages: string[];
    onAddPreset: (message: string) => void;
    onDeletePreset: (index: number) => void;
    onUpdatePreset: (index: number, message: string) => void;
    onToggleBlink: () => void;
    isBlinking: boolean;
    onClearMessage: () => void;
    isModerator: boolean;
    imagePresets: ImagePreset[];
    onAddImagePreset: (preset: ImagePreset) => void;
    onDeleteImagePreset: (index: number) => void;
    onSendImage: (dataUrl: string, fit: ImageFit) => void;
    styles: Styles;
}

const ConsolePanel = (props: ConsolePanelProps) => {
  const {
      onSetTime, onStartPause, onReset, onSendMessage, onOpenSettings, isRunning, initialTime,
      displayMode, onSetDisplayMode, presetMessages, onAddPreset, onDeletePreset, onUpdatePreset,
      onToggleBlink, isBlinking, onClearMessage, isModerator,
      imagePresets, onAddImagePreset, onDeleteImagePreset, onSendImage, styles
  } = props;

  const [minutes, setMinutes] = useState(String(Math.floor(initialTime / 60)));
  const [seconds, setSeconds] = useState(String(initialTime % 60));
  const [customMessage, setCustomMessage] = useState("");
  const [newPreset, setNewPreset] = useState("");
  const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);
  const [editingPresetText, setEditingPresetText] = useState("");

  // Sync timer inputs when initialTime prop changes from Firebase
  useEffect(() => {
    setMinutes(String(Math.floor(initialTime / 60)));
    setSeconds(String(initialTime % 60));
  }, [initialTime]);


  // Image upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newImage, setNewImage] = useState<{ dataUrl: string | null; file: File | null }>({ dataUrl: null, file: null });
  const [newImagePresetName, setNewImagePresetName] = useState("");
  const [selectedImagePresetIdx, setSelectedImagePresetIdx] = useState("");
  const [imageFit, setImageFit] = useState<ImageFit>(styles.image?.fit || 'contain');

  useEffect(() => {
    if (styles.image?.fit) {
        setImageFit(styles.image.fit);
    }
  }, [styles.image?.fit]);

  const displayModes = isModerator
    ? [ { key: 'message', label: '메시지' }, { key: 'mixed', label: '메시지+타이머' }, { key: 'timer', label: '타이머' }, { key: 'image', label: '이미지' } ]
    : [ { key: 'timer', label: '타이머' }, { key: 'message', label: '메시지' }, { key: 'mixed', label: '메시지+타이머' } ];

  const handleAddPresetClick = () => {
      if (newPreset.trim()) {
          onAddPreset(newPreset.trim());
          setNewPreset("");
      }
  };

  const handleEditClick = (index: number, text: string) => {
    setEditingPresetIndex(index);
    setEditingPresetText(text);
  };

  const handleSaveEdit = () => {
    if (editingPresetText.trim() && editingPresetIndex !== null) {
        onUpdatePreset(editingPresetIndex, editingPresetText.trim());
    }
    setEditingPresetIndex(null);
    setEditingPresetText("");
  };

  const handleCancelEdit = () => {
    setEditingPresetIndex(null);
    setEditingPresetText("");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            if (e.target?.result && typeof e.target.result === 'string') {
              setNewImage({ dataUrl: e.target.result, file: file });
              setNewImagePresetName(file.name.split('.').slice(0, -1).join('.'));
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleAddImagePresetClick = () => {
    if (newImage.dataUrl && newImagePresetName.trim()) {
        onAddImagePreset({ name: newImagePresetName.trim(), dataUrl: newImage.dataUrl, fit: imageFit });
        // Reset fields
        setNewImage({ dataUrl: null, file: null });
        setNewImagePresetName("");
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  const handleSendToPreviewClick = () => {
    if (newImage.dataUrl && newImagePresetName.trim()) {
        const newPreset: ImagePreset = { name: newImagePresetName.trim(), dataUrl: newImage.dataUrl, fit: imageFit };
        onAddImagePreset(newPreset);
        onSendImage(newPreset.dataUrl, newPreset.fit);
        // Reset fields
        setNewImage({ dataUrl: null, file: null });
        setNewImagePresetName("");
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteImagePresetClick = () => {
      if (selectedImagePresetIdx !== "") {
          onDeleteImagePreset(parseInt(selectedImagePresetIdx, 10));
          setSelectedImagePresetIdx(""); // Reset selection after delete
      }
  };

  const TimerSettings = () => (
    <div className="control-group">
        <label>타이머 설정</label>
        <div className="timer-controls">
            <div className="timer-input-group">
                <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="분" min="0" aria-label="Minutes" />
                <span>분</span>
                <input type="number" value={seconds} onChange={(e) => setSeconds(e.target.value)} placeholder="초" min="0" max="59" aria-label="Seconds" />
                <span>초</span>
            </div>
            <button className="primary" onClick={() => onSetTime(parseInt(minutes, 10) || 0, parseInt(seconds, 10) || 0)}>시간 설정</button>
            <button className="success" onClick={onStartPause}>{isRunning ? "일시정지" : "시작"}</button>
            <button className="danger" onClick={onReset}>초기화</button>
        </div>
    {/* FIX: Added a closing div tag for `control-group`. Its absence was causing a major parsing error that affected the entire file. */}
    </div>
  );

  return (
    <div className="panel console-panel">
      <h2>콘솔 (Console)</h2>

      {!isModerator && <TimerSettings />}

       <div className="control-group">
        <label>송출 모드</label>
        <div className="input-row mode-buttons">
          {displayModes.map(mode => (
            <button
              key={mode.key}
              className={displayMode === mode.key ? 'active' : ''}
              onClick={() => onSetDisplayMode(mode.key as DisplayMode)}
              style={{flex:1}}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <label>메시지 전송</label>
        <div className="preset-buttons">
          {presetMessages.map((msg, index) => (
            <div key={index} className={`preset-item ${editingPresetIndex === index ? 'editing' : ''}`}>
              {editingPresetIndex === index ? (
                <div className="preset-edit-controls">
                    <textarea 
                        value={editingPresetText}
                        onChange={(e) => setEditingPresetText(e.target.value)}
                        rows={2}
                        autoFocus
                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                          if (e.key === 'Enter' && !e.altKey) {
                            e.preventDefault();
                            handleSaveEdit();
                          }
                        }}
                    />
                    <button onClick={handleSaveEdit}>저장</button>
                    <button onClick={handleCancelEdit}>취소</button>
                </div>
              ) : (
                <>
                  <button onClick={() => onSendMessage(msg)}>{msg}</button>
                  <button className="edit-preset-btn" onClick={() => handleEditClick(index, msg)} aria-label={`Edit preset: ${msg}`}>✏️</button>
                  <button className="delete-preset-btn" onClick={() => onDeletePreset(index)} aria-label={`Delete preset: ${msg}`}>×</button>
                </>
              )}
            </div>
          ))}
        </div>
         <div className="input-row">
          <textarea 
            value={newPreset} 
            onChange={(e) => setNewPreset(e.target.value)} 
            placeholder="새 프리셋 (Enter로 추가, Alt+Enter 줄바꿈)"
            rows={2}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.altKey) {
                e.preventDefault();
                handleAddPresetClick();
              }
            }}
          />
          <button onClick={handleAddPresetClick}>추가</button>
        </div>
        <div className="input-row">
          <textarea 
            value={customMessage} 
            onChange={(e) => setCustomMessage(e.target.value)} 
            placeholder="직접 메시지 입력 (Enter로 전송, Alt+Enter 줄바꿈)" 
            rows={2}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.altKey) {
                e.preventDefault();
                if (customMessage.trim()) {
                  onSendMessage(customMessage);
                }
              }
            }}
          />
        </div>
        <div className="input-row">
            <button className="primary" onClick={() => onSendMessage(customMessage)} style={{flex: 1}} disabled={!customMessage.trim()}>전송</button>
            <button onClick={onToggleBlink} style={{flex: 1}}>{isBlinking ? "깜빡임 해제" : "깜빡임 효과"}</button>
            <button onClick={onClearMessage} style={{flex: 1}}>메시지 지우기</button>
        </div>
      </div>
        
      <button onClick={onOpenSettings} style={{width: '100%', marginBottom: '15px'}}>스타일 상세 설정</button>
      
      {isModerator && (
        <div className="control-group">
            <label>이미지 전송</label>

            <div className="input-row" style={{marginBottom: "10px"}}>
              <select
                value={selectedImagePresetIdx}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const idxString = e.target.value;
                    setSelectedImagePresetIdx(idxString);
                    if (idxString !== "") {
                      const index = parseInt(idxString, 10);
                      const preset = imagePresets[index];
                      onSendImage(preset.dataUrl, preset.fit || 'contain');
                    }
                }}
                aria-label="이미지 프리셋에서 선택"
                style={{flexGrow: 1}}
              >
                <option value="">프리셋에서 선택...</option>
                {imagePresets.map((preset, index) => (
                  <option key={index} value={index}>{preset.name}</option>
                ))}
              </select>
              <button 
                className="danger" 
                onClick={handleDeleteImagePresetClick}
                disabled={selectedImagePresetIdx === ""}
                aria-label="선택한 이미지 프리셋 삭제"
              >
                삭제
              </button>
            </div>
            
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} />
            <button onClick={() => fileInputRef.current?.click()}>이미지 선택</button>
            
            {newImage.dataUrl && (
                <div className="image-upload-area">
                    <img src={newImage.dataUrl} alt="Preview" className="image-upload-preview" />
                    <div className="input-row">
                        <input type="text" value={newImagePresetName} onChange={(e) => setNewImagePresetName(e.target.value)} placeholder="이미지 이름" />
                    </div>
                    <div className="control-row">
                      <label>이미지 맞춤</label>
                      <div className="image-fit-options">
                        <label>
                          <input type="radio" name="imageFit" value="contain" checked={imageFit === 'contain'} onChange={(e) => setImageFit(e.target.value as ImageFit)} />
                          <span>한 화면에 보이기</span>
                        </label>
                        <label>
                          <input type="radio" name="imageFit" value="width" checked={imageFit === 'width'} onChange={(e) => setImageFit(e.target.value as ImageFit)} />
                          <span>가로 폭 맞춤</span>
                        </label>
                      </div>
                    </div>
                    <div className="input-row">
                        <button onClick={handleAddImagePresetClick} disabled={!newImagePresetName.trim()} style={{flex: 1}}>프리셋으로 저장</button>
                        <button className="primary" onClick={handleSendToPreviewClick} disabled={!newImagePresetName.trim()} style={{flex: 1}}>미리보기 송출</button>
                    </div>
                </div>
            )}

        </div>
      )}
    </div>
  );
};

interface SpeakerPanelProps {
    title: string;
    timeRemaining: number;
    message: string;
    isBlinking: boolean;
    styles: Styles;
    displayMode: DisplayMode;
    imageSrc: string;
    imageFit: ImageFit;
}

const SpeakerPanel = ({ title, timeRemaining, message, isBlinking, styles, displayMode, imageSrc, imageFit }: SpeakerPanelProps) => {
    const showTimer = displayMode === 'timer' || displayMode === 'mixed';
    const showMessage = (displayMode === 'message' || displayMode === 'mixed') && message;
    const showImage = displayMode === 'image' && imageSrc;
    const showFallbackTimer = displayMode === 'message' && !message && !imageSrc;
    const isScrollableImage = showImage && imageFit === 'width';
    
    const timerFontSize = displayMode === 'timer' 
        ? styles.timer.fontSizes.timer 
        : styles.timer.fontSizes.mixed;

    const modeClassName = {
        timer: 'timer-mode',
        message: 'message-mode',
        mixed: 'mixed-mode',
        image: 'image-mode',
    }[displayMode] || '';

    const panelContent = () => {
        if (showImage) {
             const imageStyle: React.CSSProperties = {
                width: '100%',
                height: isScrollableImage ? 'auto' : '100%',
                objectFit: isScrollableImage ? 'initial' : 'contain',
            };
            return <img src={imageSrc} alt="송출 이미지" className="speaker-image" style={imageStyle} />;
        }
        return (
            <>
                {showMessage && (
                    <span className={`speaker-text message-text ${isBlinking ? 'blinking' : ''}`} style={{ color: styles.message.color, fontSize: `${styles.message.fontSize}cqw` }}>
                        {message}
                    </span>
                )}
                {(showTimer || showFallbackTimer) && (
                    <span 
                      className={`speaker-text timer-text ${displayMode === 'mixed' ? 'corner-timer' : ''}`} 
                      style={{ 
                        color: styles.timer.color, 
                        fontSize: `${timerFontSize}cqw`
                      }}
                    >
                        {formatTime(timeRemaining)}
                    </span>
                )}
            </>
        );
    };

    return (
        <div className="panel speaker-panel">
            {title && <h2>{title}</h2>}
            <div className={`speaker-panel-content ${modeClassName} ${isScrollableImage ? 'scrollable' : ''}`} style={{ backgroundColor: styles.backgroundColor, fontFamily: styles.fontFamily }}>
                {panelContent()}
            </div>
        </div>
    );
};


interface SelectionScreenProps {
    onSelect: (view: View, sessionId: string) => void;
    onSessionIdConfirm: (sessionId: string) => void;
    onLeaveSession: () => void;
    currentSessionId: string;
    savedConfigs: SavedConfig[];
    onSave: (name: string) => void;
    onLoad: (name: string) => void;
    onDelete: (name: string) => void;
}

const SelectionScreen = ({ onSelect, onSessionIdConfirm, onLeaveSession, currentSessionId, savedConfigs, onSave, onLoad, onDelete }: SelectionScreenProps) => {
  const [configName, setConfigName] = useState("");
  const [selectedConfig, setSelectedConfig] = useState("");
  const [sessionIdInput, setSessionIdInput] = useState("");
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('session');
    if (sessionFromUrl && !currentSessionId) {
        onSessionIdConfirm(sessionFromUrl);
    }
  }, []);

  useEffect(() => {
    // If configs are available, select the first one by default
    if (savedConfigs.length > 0 && selectedConfig === "") {
        setSelectedConfig(savedConfigs[0].name);
    }
  }, [savedConfigs, selectedConfig]);


  const handleSaveClick = () => {
    if (configName.trim()) {
        onSave(configName.trim());
        setConfigName("");
    } else {
        alert("저장할 설정의 이름을 입력해주세요.");
    }
  };
  
  const handleLoadClick = () => {
    if (selectedConfig) {
        onLoad(selectedConfig);
        alert(`'${selectedConfig}' 설정을 불러왔습니다.`);
    } else {
        alert("불러올 설정을 선택해주세요.");
    }
  };
  
  const handleDeleteClick = () => {
    if (selectedConfig && confirm(`'${selectedConfig}' 설정을 정말 삭제하시겠습니까?`)) {
        onDelete(selectedConfig);
        setSelectedConfig(savedConfigs.length > 1 ? savedConfigs[0].name : "");
    }
  };
  
  const handleJoinClick = () => {
      if (sessionIdInput.trim()) {
          onSessionIdConfirm(sessionIdInput.trim());
      }
  };

  if (!currentSessionId) {
    return (
        <div className="selection-container">
            <div className="selection-box">
                <h1>M&C Communicator</h1>
                
                {!isFirebaseConfigured && (
                    <div className="firebase-warning">
                        <strong>설정 필요:</strong> 실시간 공유 기능을 사용하려면 Firebase 설정이 필요합니다.
                        <br />
                        <code>index.tsx</code> 파일 상단의 <code>firebaseConfig</code> 객체를 채워주세요.
                    </div>
                )}

                <div className="session-control">
                    <label htmlFor="session-id">세션 ID</label>
                    <input 
                        id="session-id"
                        type="text"
                        value={sessionIdInput}
                        onChange={(e) => setSessionIdInput(e.target.value)}
                        placeholder="참여할 세션 ID를 입력하세요"
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinClick()}
                    />
                </div>
                 <button 
                    className="primary join-button" 
                    onClick={handleJoinClick} 
                    disabled={!sessionIdInput.trim() || !isFirebaseConfigured}
                >
                    세션 참여
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="selection-container">
      <div className="selection-box">
        <h1>M&C Communicator</h1>
        
        <div className="session-display">
            <span>세션 ID: <strong>{currentSessionId}</strong></span>
            <button onClick={onLeaveSession} className="secondary">세션 변경</button>
        </div>

        <p>어떤 화면으로 접속하시겠습니까?</p>
        <div className="selection-grid">
          <button onClick={() => onSelect('moderator_console', currentSessionId)} disabled={!isFirebaseConfigured}>사회자용 콘솔</button>
          <button onClick={() => onSelect('speaker_console', currentSessionId)} disabled={!isFirebaseConfigured}>발표자용 콘솔</button>
          <button onClick={() => onSelect('moderator_screen', currentSessionId)} disabled={!isFirebaseConfigured}>사회자 화면</button>
          <button onClick={() => onSelect('speaker_screen', currentSessionId)} disabled={!isFirebaseConfigured}>발표자 화면</button>
        </div>

        <div className="settings-management">
          <fieldset>
            <legend>설정 관리</legend>
            <div className="control-row">
              <select 
                value={selectedConfig} 
                onChange={(e) => setSelectedConfig(e.target.value)}
                aria-label="저장된 설정 목록"
                disabled={savedConfigs.length === 0}
              >
                 {savedConfigs.length === 0 ? (
                    <option>저장된 설정 없음</option>
                 ) : (
                    savedConfigs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                 )}
              </select>
              <div className="button-group">
                <button onClick={handleLoadClick} disabled={savedConfigs.length === 0}>불러오기</button>
                <button className="danger" onClick={handleDeleteClick} disabled={savedConfigs.length === 0}>삭제</button>
              </div>
            </div>
            <div className="control-row">
              <input 
                type="text" 
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="새 설정 이름"
              />
              <div className="button-group">
                <button className="primary" onClick={handleSaveClick}>현재 설정 저장</button>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

type View = 'selection' | 'moderator_console' | 'moderator_screen' | 'speaker_console' | 'speaker_screen';

// --- Web Worker for Timer ---
const timerWorkerScript = `
  let interval;
  let time = 0;
  self.onmessage = (e) => {
    const { command, value } = e.data;
    if (command === 'start') {
      clearInterval(interval);
      interval = setInterval(() => {
        if (time > 0) {
          time--;
          self.postMessage(time);
        } else {
          self.postMessage(0);
          clearInterval(interval);
        }
      }, 1000);
    } else if (command === 'pause') {
      clearInterval(interval);
    } else if (command === 'setTime') {
      time = value;
      self.postMessage(time); // Send back the initial time to sync UI
    }
  };
`;


const App = () => {
  // View State
  const [view, setView] = useState<View>('selection'); 
  const [sessionId, setSessionId] = useState('');

  // Settings State
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);

  // --- PREVIEW STATE (Local state for consoles) ---
  // Moderator Console Preview State
  const [moderatorPreview, setModeratorPreview] = useState<ContentState>({
    displayMode: 'message', message: '', isBlinking: false, imageSrc: '', imageFit: 'contain'
  });

  // Speaker Console Preview State
  const [speakerContentPreview, setSpeakerContentPreview] = useState<ContentState>({
    displayMode: 'timer', message: '', isBlinking: false, imageSrc: '', imageFit: 'contain'
  });
  const [speakerTimerPreview, setSpeakerTimerPreview] = useState<TimerState>({
    initialTime: 30 * 60, timeRemaining: 30 * 60, isRunning: false, lastUpdatedTimestamp: 0
  });
  
  // --- LIVE STATE (from Firebase) ---
  const [liveModeratorContent, setLiveModeratorContent] = useState<ContentState | null>(null);
  const [liveSpeakerContent, setLiveSpeakerContent] = useState<ContentState | null>(null);
  const [liveSpeakerTimer, setLiveSpeakerTimer] = useState<TimerState | null>(null);

  // --- Live Timer Display State ---
  const [liveTimeDisplay, setLiveTimeDisplay] = useState<number>(0);
  const liveTimerIntervalRef = useRef<number | null>(null);

  // Common State
  const [presetMessages, setPresetMessages] = useState<string[]>(INITIAL_PRESET_MESSAGES);
  const [imagePresets, setImagePresets] = useState<ImagePreset[]>([]);
  const [styles, setStyles] = useState<Styles>({
    backgroundColor: '#000000',
    fontFamily: "Arial, sans-serif",
    timer: {
      color: '#FFFFFF',
      fontSizes: {
        timer: 31.25, // Default: 600px on 1920px width
        mixed: 7.81, // Default: 150px on 1920px width
      },
    },
    message: { color: '#FFFFFF', fontSize: 7.81 }, // Default 150px on 1920px width
    image: { fit: 'contain' },
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);

  // --- Web Worker Setup & Communication ---
  useEffect(() => {
    if (view === 'speaker_console') {
      const blob = new Blob([timerWorkerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      workerRef.current = worker;

      worker.onmessage = (e) => {
        setSpeakerTimerPreview(prev => ({ ...prev, timeRemaining: e.data }));
      };

      worker.postMessage({ command: 'setTime', value: speakerTimerPreview.timeRemaining });
      if (speakerTimerPreview.isRunning) {
        worker.postMessage({ command: 'start' });
      }

      return () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        workerRef.current = null;
      };
    }
  }, [view]);


  // --- Global Configs Listener ---
  useEffect(() => {
    if (isFirebaseConfigured && database) {
        const configsRef = ref(database, 'global_configs');
        const onConfigsUpdate = onValue(configsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const configsArray: SavedConfig[] = Object.entries(data).map(([name, settings]) => ({
                    name,
                    settings: settings as ConfigSettings,
                }));
                setSavedConfigs(configsArray);
            } else {
                setSavedConfigs([]);
            }
        });

        return () => {
            onConfigsUpdate();
        };
    }
  }, []);


  // --- Real-time Communication (Firebase Session Data) ---
  useEffect(() => {
    if (sessionId && isFirebaseConfigured && database) {
      // Moderator Screen Listener
      const moderatorContentRef = ref(database, `sessions/${sessionId}/moderator/content`);
      const onModeratorContentUpdate = onValue(moderatorContentRef, (snapshot) => {
        setLiveModeratorContent(snapshot.val());
      });

      // Speaker Screen Listeners
      const speakerContentRef = ref(database, `sessions/${sessionId}/speaker/content`);
      const onSpeakerContentUpdate = onValue(speakerContentRef, (snapshot) => {
        setLiveSpeakerContent(snapshot.val());
      });

      const speakerTimerRef = ref(database, `sessions/${sessionId}/speaker/timer`);
      const onSpeakerTimerUpdate = onValue(speakerTimerRef, (snapshot) => {
          setLiveSpeakerTimer(snapshot.val());
      });

      // Image Presets Listener
      const imagePresetsRef = ref(database, `sessions/${sessionId}/imagePresets`);
      const onImagePresetsUpdate = onValue(imagePresetsRef, (snapshot) => {
          const data = snapshot.val();
          if (data && Array.isArray(data)) {
              setImagePresets(data);
          } else {
              setImagePresets([]);
          }
      });


      return () => {
        onModeratorContentUpdate();
        onSpeakerContentUpdate();
        onSpeakerTimerUpdate();
        onImagePresetsUpdate();
      };
    }
  }, [sessionId]);
  
    // --- Live Timer Countdown Effect ---
    useEffect(() => {
        if (liveTimerIntervalRef.current) {
            clearInterval(liveTimerIntervalRef.current);
            liveTimerIntervalRef.current = null;
        }

        if (liveSpeakerTimer) {
            let initialDisplayTime = liveSpeakerTimer.timeRemaining;

            // Sync logic: calculate elapsed time if timer is running
            if (liveSpeakerTimer.isRunning && liveSpeakerTimer.lastUpdatedTimestamp) {
                const elapsedSeconds = Math.floor((Date.now() - liveSpeakerTimer.lastUpdatedTimestamp) / 1000);
                initialDisplayTime = liveSpeakerTimer.timeRemaining - elapsedSeconds;
            }

            const syncedTime = initialDisplayTime > 0 ? initialDisplayTime : 0;
            setLiveTimeDisplay(syncedTime);

            if (liveSpeakerTimer.isRunning && syncedTime > 0) {
                liveTimerIntervalRef.current = window.setInterval(() => {
                    setLiveTimeDisplay(prevTime => {
                        if (prevTime > 0) {
                            return prevTime - 1;
                        } else {
                            if (liveTimerIntervalRef.current) {
                               clearInterval(liveTimerIntervalRef.current);
                               liveTimerIntervalRef.current = null;
                            }
                            return 0;
                        }
                    });
                }, 1000);
            }
        } else {
            setLiveTimeDisplay(0);
        }

        return () => {
            if (liveTimerIntervalRef.current) {
                clearInterval(liveTimerIntervalRef.current);
                liveTimerIntervalRef.current = null;
            }
        };
    }, [liveSpeakerTimer]);


    // --- Sync Speaker Console Preview with Live Timer ---
    useEffect(() => {
        if (view === 'speaker_console' && liveSpeakerTimer && !isInitialSyncDone) {
            const elapsedSeconds = liveSpeakerTimer.isRunning && liveSpeakerTimer.lastUpdatedTimestamp
              ? Math.floor((Date.now() - liveSpeakerTimer.lastUpdatedTimestamp) / 1000)
              : 0;
            const currentTime = Math.max(0, liveSpeakerTimer.timeRemaining - elapsedSeconds);
            
            const syncedState = {
              ...liveSpeakerTimer,
              timeRemaining: currentTime,
            };

            setSpeakerTimerPreview(syncedState);
            
            if (workerRef.current) {
              workerRef.current.postMessage({ command: 'setTime', value: currentTime });
              if (syncedState.isRunning) {
                workerRef.current.postMessage({ command: 'start' });
              }
            }
            setIsInitialSyncDone(true);
        }
    }, [view, liveSpeakerTimer, isInitialSyncDone]);

    // Reset sync flag when leaving speaker console
    useEffect(() => {
        if (view !== 'speaker_console') {
            setIsInitialSyncDone(false);
        }
    }, [view]);

  // --- Broadcast Helper ---
  const broadcastTimerState = (state: TimerState) => {
    if (isFirebaseConfigured && database && sessionId) {
        const timerRef = ref(database, `sessions/${sessionId}/speaker/timer`);
        set(timerRef, { ...state, lastUpdatedTimestamp: Date.now() });
    }
  };


  // --- Speaker Timer Control Handlers ---
  const handleSetTime = (minutes: number, seconds: number) => {
    const newTime = (minutes * 60) + seconds;
    const newState = {
        initialTime: newTime,
        timeRemaining: newTime,
        isRunning: false,
    };
    setSpeakerTimerPreview(newState);
    if (workerRef.current) {
        workerRef.current.postMessage({ command: 'pause' });
        workerRef.current.postMessage({ command: 'setTime', value: newTime });
    }
    // Also broadcast if live
    if (liveSpeakerTimer) {
        broadcastTimerState(newState);
    }
  };

  const handleStartPause = () => {
    if (speakerTimerPreview.timeRemaining > 0 || !speakerTimerPreview.isRunning) {
        const newIsRunning = !speakerTimerPreview.isRunning;
        const newState = { ...speakerTimerPreview, isRunning: newIsRunning };
        setSpeakerTimerPreview(newState);

        // Real-time broadcast if timer is already live
        if (liveSpeakerTimer) {
            broadcastTimerState(newState);
        }
        
        if (workerRef.current) {
            workerRef.current.postMessage({ command: newIsRunning ? 'start' : 'pause' });
        }
    }
  };

  const handleReset = () => {
    const newState = {
        ...speakerTimerPreview,
        timeRemaining: speakerTimerPreview.initialTime,
        isRunning: false,
    };
    setSpeakerTimerPreview(newState);
    
    // Real-time broadcast if timer is already live
    if (liveSpeakerTimer) {
        broadcastTimerState(newState);
    }

    if (workerRef.current) {
        workerRef.current.postMessage({ command: 'pause' });
        workerRef.current.postMessage({ command: 'setTime', value: speakerTimerPreview.initialTime });
    }
  };
  
  // --- Common Content Control Handlers (used by both consoles) ---
  const createContentHandlers = (
    setter: React.Dispatch<React.SetStateAction<ContentState>>
  ) => ({
    onSendMessage: (msg: string) => {
        setter(prev => ({ ...prev, message: msg, displayMode: prev.displayMode === 'timer' ? 'message' : prev.displayMode }));
    },
    onSendImage: (dataUrl: string, fit: ImageFit = 'contain') => {
        setter(prev => ({ ...prev, imageSrc: dataUrl, imageFit: fit, displayMode: 'image' }));
    },
    onToggleBlink: () => setter(prev => ({ ...prev, isBlinking: !prev.isBlinking })),
    onClearMessage: () => setter(prev => ({ ...prev, message: '', imageSrc: '' })),
    onSetDisplayMode: (mode: DisplayMode) => setter(prev => ({ ...prev, displayMode: mode })),
  });

  const moderatorContentHandlers = createContentHandlers(setModeratorPreview);
  const speakerContentHandlers = createContentHandlers(setSpeakerContentPreview);
  
  // --- Common Preset Handlers ---
  const handleAddPreset = (msg: string) => setPresetMessages(prev => [...prev, msg]);
  const handleDeletePreset = (index: number) => setPresetMessages(prev => prev.filter((_, i) => i !== index));
  const handleUpdatePreset = (index: number, newMessage: string) => {
    setPresetMessages(prev => {
        const newPresets = [...prev];
        newPresets[index] = newMessage;
        return newPresets;
    });
  };

  const handleAddImagePreset = (preset: ImagePreset) => {
    if (!isFirebaseConfigured || !database || !sessionId) return;
    const newPresets = [...imagePresets, preset];
    const imagePresetsRef = ref(database, `sessions/${sessionId}/imagePresets`);
    set(imagePresetsRef, newPresets).catch(err => {
        console.error("Image preset add failed:", err);
        alert("이미지 프리셋 추가에 실패했습니다.");
    });
  };
  const handleDeleteImagePreset = (index: number) => {
    if (!isFirebaseConfigured || !database || !sessionId) return;
    const newPresets = imagePresets.filter((_, i) => i !== index);
    const imagePresetsRef = ref(database, `sessions/${sessionId}/imagePresets`);
    set(imagePresetsRef, newPresets).catch(err => {
        console.error("Image preset delete failed:", err);
        alert("이미지 프리셋 삭제에 실패했습니다.");
    });
  };
  
  const handleSaveSettings = (newStyles: Styles) => setStyles(newStyles);
  
  // --- Broadcast Handlers ---
  const handleModeratorBroadcast = () => {
    if (isFirebaseConfigured && database && sessionId) {
      const contentRef = ref(database, `sessions/${sessionId}/moderator/content`);
      set(contentRef, moderatorPreview);
    }
  };
  
  const handleSpeakerBroadcast = () => {
    if (isFirebaseConfigured && database && sessionId) {
      const contentRef = ref(database, `sessions/${sessionId}/speaker/content`);
      set(contentRef, speakerContentPreview);
      broadcastTimerState(speakerTimerPreview);
    }
  };

  // --- Navigation Handlers ---
  const handleBackToSelection = () => setView('selection');

  const handleSelectView = (selectedView: View, selectedSessionId: string) => {
      setSessionId(selectedSessionId);
      setView(selectedView);
  };
  
  const handleSessionIdConfirm = (id: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set('session', id);
      window.history.pushState({}, '', url);
      setSessionId(id);
  };
  
  const handleLeaveSession = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('session');
      window.history.pushState({}, '', url);
      setSessionId('');
  };

  // --- Config Management Handlers ---
  const handleSaveConfig = (name: string) => {
    if (!isFirebaseConfigured || !database) return;
    
    const currentSettings = { styles, presetMessages }; // Exclude imagePresets
    const existingConfig = savedConfigs.find(c => c.name === name);

    const performSave = () => {
      const configRef = ref(database, `global_configs/${name}`);
      set(configRef, currentSettings)
        .then(() => {
          alert(`'${name}' 설정을 ${existingConfig ? '업데이트했습니다' : '저장했습니다'}.`);
        })
        .catch(err => {
          console.error("Config save failed:", err);
          alert("설정 저장에 실패했습니다.");
        });
    };

    if (existingConfig) {
      if (confirm(`'${name}' 설정이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        performSave();
      }
    } else {
      performSave();
    }
  };

  const handleLoadConfig = (name: string) => {
    const configToLoad = savedConfigs.find(c => c.name === name);
    if (configToLoad) {
        // Ensure backward compatibility with old configs
        const loadedStyles: Styles = {
            ...styles,
            ...configToLoad.settings.styles,
            image: { ...styles.image, ...configToLoad.settings.styles?.image },
        };
        setStyles(loadedStyles);
        setPresetMessages(configToLoad.settings.presetMessages || []);
        // NOTE: We intentionally do NOT load imagePresets from a global config.
    }
  };

  const handleDeleteConfig = (name: string) => {
    if (!isFirebaseConfigured || !database) return;
    const configRef = ref(database, `global_configs/${name}`);
    set(configRef, null).catch(err => {
        console.error("Config delete failed:", err);
        alert("설정 삭제에 실패했습니다.");
    });
  };


  if (view === 'selection') {
    return <SelectionScreen 
              onSelect={handleSelectView} 
              onSessionIdConfirm={handleSessionIdConfirm}
              onLeaveSession={handleLeaveSession}
              currentSessionId={sessionId}
              savedConfigs={savedConfigs}
              onSave={handleSaveConfig}
              onLoad={handleLoadConfig}
              onDelete={handleDeleteConfig}
           />;
  }

  const BackButton = () => <button className="back-button" onClick={handleBackToSelection}>← 선택 화면</button>;
  
  // FIX: Renamed second `onDeletePreset` to `onDeleteImagePreset` to match the prop name in `ConsolePanelProps` and resolve a duplicate property error.
  const commonConsoleProps = {
    onOpenSettings: () => setIsSettingsOpen(true),
    presetMessages, onAddPreset: handleAddPreset, onDeletePreset: handleDeletePreset, onUpdatePreset: handleUpdatePreset,
    imagePresets, onAddImagePreset: handleAddImagePreset, onDeleteImagePreset: handleDeleteImagePreset,
    styles,
  };

  if (view === 'moderator_console') {
    return (
      <>
        <div className="main-header">
          <h1>사회자용 콘솔 (Moderator Console)</h1>
          <BackButton />
          <button className="switch-console-button" onClick={() => setView('speaker_console')}>발표자 콘솔 바로가기 →</button>
        </div>
        <div className="app-container">
          <ConsolePanel 
            {...commonConsoleProps}
            {...moderatorContentHandlers}
            isModerator={true}
            onSetTime={() => {}} onStartPause={() => {}} onReset={() => {}}
            isRunning={false} initialTime={0}
            displayMode={moderatorPreview.displayMode}
            isBlinking={moderatorPreview.isBlinking}
          />
          <div className="speaker-section">
              <SpeakerPanel 
                title="미리보기 (사회자 화면)"
                timeRemaining={liveTimeDisplay}
                message={moderatorPreview.message}
                isBlinking={moderatorPreview.isBlinking}
                styles={styles}
                displayMode={moderatorPreview.displayMode}
                imageSrc={moderatorPreview.imageSrc}
                imageFit={moderatorPreview.imageFit}
              />
              <div className="broadcast-controls">
                  <button className="broadcast-button" onClick={handleModeratorBroadcast}>사회자 화면으로 송출</button>
              </div>
               <SpeakerPanel 
                title="송출 화면 (사회자 Live)"
                timeRemaining={liveTimeDisplay}
                message={liveModeratorContent?.message ?? ''}
                isBlinking={liveModeratorContent?.isBlinking ?? false}
                styles={styles}
                displayMode={liveModeratorContent?.displayMode ?? 'message'}
                imageSrc={liveModeratorContent?.imageSrc ?? ''}
                imageFit={liveModeratorContent?.imageFit ?? 'contain'}
              />
          </div>
        </div>
        {isSettingsOpen && (
          <SettingsModal 
            initialStyles={styles} onSave={handleSaveSettings} onClose={() => setIsSettingsOpen(false)}
            fonts={INITIAL_FONTS} currentDisplayMode={moderatorPreview.displayMode} isModerator={true}
          />
        )}
      </>
    );
  }

  if (view === 'speaker_console') {
    return (
      <>
        <div className="main-header">
          <h1>발표자용 콘솔 (Speaker Console)</h1>
          <BackButton />
          <button className="switch-console-button" onClick={() => setView('moderator_console')}>사회자 콘솔 바로가기 →</button>
        </div>
        <div className="app-container">
          <ConsolePanel 
            {...commonConsoleProps}
            {...speakerContentHandlers}
            isModerator={false}
            onSetTime={handleSetTime} onStartPause={handleStartPause} onReset={handleReset}
            isRunning={speakerTimerPreview.isRunning} initialTime={speakerTimerPreview.initialTime}
            displayMode={speakerContentPreview.displayMode}
            isBlinking={speakerContentPreview.isBlinking}
          />
          <div className="speaker-section">
              <SpeakerPanel 
                title="미리보기 (발표자 화면)"
                timeRemaining={speakerTimerPreview.timeRemaining}
                message={speakerContentPreview.message}
                isBlinking={speakerContentPreview.isBlinking}
                styles={styles}
                displayMode={speakerContentPreview.displayMode}
                imageSrc={speakerContentPreview.imageSrc}
                imageFit={speakerContentPreview.imageFit}
              />
              <div className="broadcast-controls">
                  <button className="broadcast-button" onClick={handleSpeakerBroadcast}>발표자 화면으로 송출</button>
              </div>
               <SpeakerPanel 
                title="송출 화면 (발표자 Live)"
                timeRemaining={liveTimeDisplay}
                message={liveSpeakerContent?.message ?? ''}
                isBlinking={liveSpeakerContent?.isBlinking ?? false}
                styles={styles}
                displayMode={liveSpeakerContent?.displayMode ?? 'timer'}
                imageSrc={liveSpeakerContent?.imageSrc ?? ''}
                imageFit={liveSpeakerContent?.imageFit ?? 'contain'}
              />
          </div>
        </div>
        {isSettingsOpen && (
          <SettingsModal 
            initialStyles={styles} onSave={handleSaveSettings} onClose={() => setIsSettingsOpen(false)}
            fonts={INITIAL_FONTS} currentDisplayMode={speakerContentPreview.displayMode} isModerator={false}
          />
        )}
      </>
    );
  }

  if (view === 'moderator_screen') {
    return (
      <div className="fullscreen-view">
        <button className="fullscreen-close-button" onClick={handleBackToSelection} aria-label="선택 화면으로 돌아가기">&times;</button>
        <SpeakerPanel
          title=""
          timeRemaining={liveTimeDisplay}
          message={liveModeratorContent?.message ?? ''}
          isBlinking={liveModeratorContent?.isBlinking ?? false}
          styles={styles}
          displayMode={liveModeratorContent?.displayMode ?? 'message'}
          imageSrc={liveModeratorContent?.imageSrc ?? ''}
          imageFit={liveModeratorContent?.imageFit ?? 'contain'}
        />
      </div>
    );
  }
  
    if (view === 'speaker_screen') {
    return (
      <div className="fullscreen-view">
        <button className="fullscreen-close-button" onClick={handleBackToSelection} aria-label="선택 화면으로 돌아가기">&times;</button>
        <SpeakerPanel
          title=""
          timeRemaining={liveTimeDisplay}
          message={liveSpeakerContent?.message ?? ''}
          isBlinking={liveSpeakerContent?.isBlinking ?? false}
          styles={styles}
          displayMode={liveSpeakerContent?.displayMode ?? 'timer'}
          imageSrc={liveSpeakerContent?.imageSrc ?? ''}
          imageFit={liveSpeakerContent?.imageFit ?? 'contain'}
        />
      </div>
    );
  }

  // Fallback to the selection screen
  return <SelectionScreen 
            onSelect={handleSelectView}
            onSessionIdConfirm={handleSessionIdConfirm}
            onLeaveSession={handleLeaveSession}
            currentSessionId={sessionId}
            savedConfigs={savedConfigs}
            onSave={handleSaveConfig}
            onLoad={handleLoadConfig}
            onDelete={handleDeleteConfig}
         />;
};

const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
}