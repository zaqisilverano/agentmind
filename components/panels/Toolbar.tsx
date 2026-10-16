'use client';

import type { Mode, ThemeId } from '@/engine/types';
import { THEMES } from '@/engine/themes';
import { useStore } from '@/lib/store';
import { Dropdown } from '@/components/ui/Dropdown';
import { MenuItem } from '@/components/ui/MenuItem';
import { SettingsMenu } from './SettingsMenu';

const MODES: [Mode, string][] = [['constellation', 'Constellation'], ['orbit', 'Orbit'], ['terrain', 'Terrain']];
const THEME_IDS = Object.keys(THEMES) as ThemeId[];

const SEGMENT = 'flex items-center gap-2 px-[14px] py-[10px] font-mono text-[11px] uppercase leading-[normal] tracking-[0.12em]';
const TRIGGER = `${SEGMENT} border-r border-ink bg-panel text-ink data-[open=true]:bg-ink data-[open=true]:text-panel`;
const KEY = 'text-muted group-data-[open=true]:text-faint';
const caret = (open: boolean) => (open ? '▴' : '▾');

export interface ToolbarProps {
  /** Task 19 supplies the 3D HTML export; until then the button is disabled. */
  onDownloadHtml3d?: () => void;
}

/** Top-right segmented bar: View, Design, Settings dropdowns and the Focus button. */
export function Toolbar({ onDownloadHtml3d }: ToolbarProps) {
  const mode = useStore(s => s.mode);
  const theme = useStore(s => s.theme);
  const setMode = useStore(s => s.setMode);
  const setTheme = useStore(s => s.setTheme);
  const setFocus = useStore(s => s.setFocus);
  const setOpenDropdown = useStore(s => s.setOpenDropdown);
  const modeLabel = MODES.find(([id]) => id === mode)?.[1] ?? MODES[0][1];

  const enterFocus = () => {
    setOpenDropdown(null);
    setFocus(true);
  };

  return (
    // The outer box is the menus' anchor; it has no border, so menus line up with the bar's outer edge.
    <div className="fixed top-10 right-11 z-[2]">
      <div className="flex border border-ink bg-panel shadow-[var(--shadow3)]">
        <Dropdown id="view" triggerClassName={TRIGGER} menuClassName="w-[242px]" label={open => <><span className={KEY}>View</span>{modeLabel} {caret(open)}</>}>
          {close => MODES.map(([id, label]) => (
            <MenuItem key={id} active={mode === id} onClick={() => { setMode(id); close(); }}>{label}</MenuItem>
          ))}
        </Dropdown>
        <Dropdown id="design" triggerClassName={TRIGGER} menuClassName="w-[242px]" label={open => <><span className={KEY}>Design</span>{THEMES[theme].label} {caret(open)}</>}>
          {close => THEME_IDS.map(id => (
            <MenuItem
              key={id}
              active={theme === id}
              onClick={() => { setTheme(id); close(); }}
              lead={<span className="h-4 w-4 flex-none border border-ink" style={{ background: THEMES[id].bg }} />}
            >
              {THEMES[id].label}
            </MenuItem>
          ))}
        </Dropdown>
        <Dropdown id="settings" title="Rounds and downloads" triggerClassName={TRIGGER} menuClassName="w-[302px] max-w-[calc(100vw-86px)]" label={open => <>Settings {caret(open)}</>}>
          <SettingsMenu onDownloadHtml3d={onDownloadHtml3d} />
        </Dropdown>
        <button
          type="button"
          title="Focus mode: hide all panels"
          onClick={enterFocus}
          className={`${SEGMENT} cursor-pointer bg-accent text-[#1B1A17] hover:bg-ink hover:text-panel`}
        >
          Focus
        </button>
      </div>
    </div>
  );
}
