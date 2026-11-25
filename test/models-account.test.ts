import { describe, expect, it } from 'vitest';
import {
  Account,
  Alert,
  AlertButton,
  ExperimentDetail,
  ExperimentDetailValue,
  ExperimentsDetails,
  Plus,
  StationData,
  Status,
  Subscription,
} from '../src/index.js';
import type { Client, UnknownFieldsReport } from '../src/index.js';

describe('account models', () => {
  it('AlertButton', () => {
    const m = AlertButton.deJson({ text: 'Go', bgColor: '#fff', textColor: '#000', uri: 'https://x' });
    expect(m).toBeInstanceOf(AlertButton);
    expect(m).toMatchObject({ text: 'Go', bgColor: '#fff', textColor: '#000', uri: 'https://x' });
    expect(AlertButton.deJson(null)).toBeNull();
  });

  it('Alert nests AlertButton', () => {
    const m = Alert.deJson({
      alertId: 'xxx',
      text: 't',
      bgColor: 'b',
      textColor: 'c',
      alertType: 'plus',
      closeButton: true,
      button: { text: 'Go', uri: 'u' },
    });
    expect(m).toBeInstanceOf(Alert);
    expect(m?.alertId).toBe('xxx');
    expect(m?.closeButton).toBe(true);
    expect(m?.button).toBeInstanceOf(AlertButton);
    expect(m?.button?.uri).toBe('u');
  });

  it('StationData', () => {
    const m = StationData.deJson({ name: 'My wave' });
    expect(m).toBeInstanceOf(StationData);
    expect(m?.name).toBe('My wave');
  });

  it('Status types stationData and barBelow', () => {
    const m = Status.deJson({
      stationData: { name: 'S' },
      barBelow: { alertId: 'a', button: { text: 'b' } },
      hasOptions: true,
      account: { regionCode: 'RU', nonOwnerFamilyMember: false },
      plus: { hasPlus: true, migrated: true },
      subscription: { nonAutoRenewableRemainder: { days: 3 } },
    });
    expect(m?.stationData).toBeInstanceOf(StationData);
    expect(m?.barBelow).toBeInstanceOf(Alert);
    expect(m?.barBelow?.button).toBeInstanceOf(AlertButton);
    expect(m?.hasOptions).toBe(true);
    expect(m?.account).toBeInstanceOf(Account);
    expect(m?.account?.regionCode).toBe('RU');
    expect(m?.account?.nonOwnerFamilyMember).toBe(false);
    expect(m?.plus).toBeInstanceOf(Plus);
    expect(m?.plus?.migrated).toBe(true);
    expect(m?.subscription).toBeInstanceOf(Subscription);
    expect(m?.subscription?.nonAutoRenewableRemainder?.days).toBe(3);
  });

  it('Status reports no unknown fields for the new typed keys', () => {
    const reports: UnknownFieldsReport[] = [];
    const client = { onUnknownField: (r: UnknownFieldsReport) => reports.push(r) } as unknown as Client;
    Status.deJson({ stationData: { name: 'S' }, barBelow: { alertId: 'a' }, hasOptions: false }, client);
    expect(reports).toEqual([]);
  });

  it('ExperimentsDetails keeps values and adds typed experiments', () => {
    const raw = {
      AliceTest: { group: 'on', value: { title: 'on', flag: true, ids: [1, 2] } },
      Other: { group: 'x' },
      Bad: 'oops',
    };
    const m = ExperimentsDetails.deJson(raw);
    expect(m).toBeInstanceOf(ExperimentsDetails);
    expect(m?.values).toEqual(raw);
    expect(Object.keys(m?.experiments ?? {})).toEqual(['AliceTest', 'Other']);
    const detail = m?.experiments?.['AliceTest'];
    expect(detail).toBeInstanceOf(ExperimentDetail);
    expect(detail?.group).toBe('on');
    expect(detail?.value).toBeInstanceOf(ExperimentDetailValue);
    expect(detail?.value?.title).toBe('on');
    expect(detail?.value?.extra).toEqual({ flag: true, ids: [1, 2] });
    expect(m?.experiments?.['Other']?.value).toBeUndefined();
  });
});
