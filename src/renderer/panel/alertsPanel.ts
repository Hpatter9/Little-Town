// Phone alerts panel (opened from the tray, or the phone's ☰ menu): ntfy topic, what to be told about, a test button.

import { validTopic, type AlertSettings, type Bridge } from '../../shared/ipc';
import { button, el } from './dom';

export function renderAlerts(bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [];
  out.push(
    el(
      'div',
      'hint',
      'Get a push on your phone when raiders reach the town while you\'re away: they wait at the gate for you to watch the fight (up to 12 hours), and when a choice comes up (the town pauses until you answer). Install the free ntfy app, subscribe to a topic name only you know, and enter the same name here. Then tap Send a test alert. When you leave the game, it looks ahead and books the alerts.',
    ),
  );
  const form = el('div', 'alerts-form');
  out.push(form);
  const status = el('div', 'lock');
  out.push(status);
  if (!bridge) return out;

  void bridge.getAlerts().then((a) => {
    let cur: AlertSettings = a;
    const save = async (patch: Partial<AlertSettings>) => {
      cur = await bridge.setAlerts({ ...cur, ...patch });
      paint();
    };
    const topic = el('input');
    topic.type = 'text';
    topic.placeholder = 'e.g. littletown-8f3kq2';
    topic.value = cur.topic;
    topic.maxLength = 64;
    topic.addEventListener('change', () => void save({ topic: topic.value.trim(), enabled: cur.enabled || validTopic(topic.value.trim()) }));
    const server = el('input');
    server.type = 'text';
    server.value = cur.server;
    server.addEventListener('change', () => void save({ server: server.value.trim() }));
    const lead = el('input');
    lead.type = 'number';
    lead.min = '0';
    lead.max = '120';
    lead.value = String(cur.leadMinutes);
    lead.addEventListener('change', () => void save({ leadMinutes: Number(lead.value) }));
    const check = (label: string, key: 'enabled' | 'raids' | 'deaths' | 'expeditions' | 'choices' | 'hero') => {
      const l = el('label', 'check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = cur[key];
      box.addEventListener('change', () => void save({ [key]: box.checked }));
      l.append(box, el('span', '', label));
      return l;
    };
    const paint = () => {
      form.replaceChildren(
        row('Topic', topic),
        row('Server', server),
        check('Send phone alerts', 'enabled'),
        check('Raids (before they hit)', 'raids'),
        row('Minutes of warning', lead),
        check('Deaths and kidnappings', 'deaths'),
        check('Big moments of the one you follow', 'hero'),
        check('Expeditions coming home', 'expeditions'),
        check('Other questions (answered for you after an hour)', 'choices'),
        button('Send a test alert', async () => {
          status.textContent = 'Sending…';
          status.textContent = await bridge.testAlert();
        }, { disabled: !cur.topic }),
      );
      status.textContent = cur.enabled ? `Alerts on, to "${cur.topic}".` : cur.topic ? 'Alerts are off.' : 'No topic set: nothing is ever sent.';
    };
    paint();
  });
  return out;
}

function row(label: string, input: HTMLElement): HTMLElement {
  const r = el('label', 'form-row');
  r.append(el('span', 'form-label', label), input);
  return r;
}
