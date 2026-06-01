import {
  createDefaultChoices,
  DEFAULT_MULTIPLE_CHOICE_COUNT,
  isDefaultChoiceSet,
  MAX_MULTIPLE_CHOICE_COUNT,
  MIN_MULTIPLE_CHOICE_COUNT,
} from '../../src/services/quiz-choice-utils';

describe('quiz-choice-utils', () => {
  it('creates default choices with 4 items by default', () => {
    const choices = createDefaultChoices();
    expect(choices).toHaveLength(DEFAULT_MULTIPLE_CHOICE_COUNT);
    expect(choices[0]).toMatchObject({ choiceText: '選択肢 1', isCorrect: true });
    expect(choices[3]).toMatchObject({ choiceText: '選択肢 4', isCorrect: false });
  });

  it('creates the requested number of default choices within bounds', () => {
    expect(createDefaultChoices(MIN_MULTIPLE_CHOICE_COUNT)).toHaveLength(2);
    expect(createDefaultChoices(MAX_MULTIPLE_CHOICE_COUNT)).toHaveLength(10);
  });

  it('detects default and customized choice sets', () => {
    expect(isDefaultChoiceSet(createDefaultChoices())).toBe(true);

    const customized = createDefaultChoices();
    customized[0].choiceText = 'useState';
    expect(isDefaultChoiceSet(customized)).toBe(false);

    expect(isDefaultChoiceSet(createDefaultChoices(5))).toBe(false);
  });
});
