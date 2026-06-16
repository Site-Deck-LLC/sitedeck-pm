import {
  parseMsProjectXml,
} from './msproject-parser.service';

const SAMPLE_MSP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Demo MSP Project</Name>
  <StartDate>2024-03-01T08:00:00</StartDate>
  <FinishDate>2024-03-31T17:00:00</FinishDate>
  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Site Prep</Name>
      <WBS>1.1</WBS>
      <Start>2024-03-01T08:00:00</Start>
      <Finish>2024-03-05T17:00:00</Finish>
      <Duration>P5DT0H0M0S</Duration>
      <PercentComplete>50</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Foundation</Name>
      <WBS>1.2</WBS>
      <Start>2024-03-06T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P10DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
    </Task>
    <Task>
      <UID>3</UID>
      <ID>3</ID>
      <Name>Foundation Milestone</Name>
      <WBS>1.3</WBS>
      <Start>2024-03-15T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P0DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>1</Milestone>
      <Summary>0</Summary>
      <OutlineLevel>2</OutlineLevel>
      <PredecessorLink>
        <PredecessorUID>2</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
        <LagFormat>5</LagFormat>
      </PredecessorLink>
    </Task>
    <Task>
      <UID>4</UID>
      <ID>4</ID>
      <Name>Phase 1 Summary</Name>
      <WBS>1</WBS>
      <Start>2024-03-01T08:00:00</Start>
      <Finish>2024-03-15T17:00:00</Finish>
      <Duration>P15DT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <Milestone>0</Milestone>
      <Summary>1</Summary>
      <OutlineLevel>1</OutlineLevel>
    </Task>
  </Tasks>
</Project>`;

describe('msproject-parser.service', () => {
  test('parseMsProjectXml extracts project info', () => {
    const result = parseMsProjectXml(SAMPLE_MSP_XML);
    expect(result.project.name).toBe('Demo MSP Project');
    expect(result.project.startDate).toBe('2024-03-01T08:00:00');
  });

  test('parseMsProjectXml extracts tasks skipping summaries', () => {
    const result = parseMsProjectXml(SAMPLE_MSP_XML);
    const tasks = result.tasks;
    expect(tasks).toHaveLength(4);
    const nonSummary = tasks.filter((t) => !t.summary);
    expect(nonSummary).toHaveLength(3);
  });

  test('parseMsProjectXml parses durations', () => {
    const result = parseMsProjectXml(SAMPLE_MSP_XML);
    const sitePrep = result.tasks.find((t) => t.name === 'Site Prep')!;
    expect(sitePrep.durationDays).toBe(5);
    const milestone = result.tasks.find((t) => t.name === 'Foundation Milestone')!;
    expect(milestone.durationDays).toBe(0);
    expect(milestone.milestone).toBe(true);
  });

  test('parseMsProjectXml parses percent complete', () => {
    const result = parseMsProjectXml(SAMPLE_MSP_XML);
    const sitePrep = result.tasks.find((t) => t.name === 'Site Prep')!;
    expect(sitePrep.percentComplete).toBe(0.5);
  });

  test('parseMsProjectXml extracts relationships', () => {
    const result = parseMsProjectXml(SAMPLE_MSP_XML);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].predecessorUid).toBe('2');
    expect(result.relationships[0].successorUid).toBe('3');
    expect(result.relationships[0].type).toBe('FS');
    expect(result.relationships[0].lagDays).toBe(0);
  });

  test('parseMsProjectXml handles empty project', () => {
    const xml = `<?xml version="1.0"?><Project><Name>Empty</Name></Project>`;
    const result = parseMsProjectXml(xml);
    expect(result.project.name).toBe('Empty');
    expect(result.tasks).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
  });
});
