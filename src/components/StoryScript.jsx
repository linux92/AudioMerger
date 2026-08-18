// StoryScript.jsx — Optional reference script textarea
export default function StoryScript({ script, onScriptChange }) {
  return (
    <div className="script-section">
      <div className="panel-header" style={{ padding: '10px 16px 8px' }}>
        <span className="panel-title">Story Script <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>(reference only)</span></span>
      </div>
      <div className="panel-body" style={{ padding: '8px 12px' }}>
        <textarea
          id="story-script-textarea"
          className="script-textarea"
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder={`Narrator: One day Ramu went to the market.\nRamu: Where are you going?\nNarrator: Ramu saw his friend near the tree.\nShopkeeper: What do you want?`}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
