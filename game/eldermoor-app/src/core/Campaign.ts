/** Milestone-driven objectives and rewards for the greybox campaign. */

export type MilestoneId =
  | 'gather'
  | 'first_bind'
  | 'lumber'
  | 'field'
  | 'path'
  | 'mire'
  | 'tower'
  | 'mael'
  | 'boss'
  | 'raid'
  | 'wand';

export interface Milestone {
  id: MilestoneId;
  title: string;
  done: boolean;
  reward?: string;
}

export class Campaign {
  milestones: Milestone[] = [
    { id: 'gather', title: 'Holz sammeln (E an braunen Stämmen)', done: false },
    { id: 'first_bind', title: 'Erste Bestie fangen (Bond-Ring + F)', done: false, reward: '+2 Fallen' },
    { id: 'lumber', title: 'Sägeplatz bauen + Arbeiter (C)', done: false, reward: '+5 Holz' },
    { id: 'field', title: 'Begleiter ins Feld (X) — grüner Balken', done: false },
    { id: 'path', title: 'Vita oder Mortis wählen (V)', done: false, reward: 'Pfad-Power' },
    { id: 'mire', title: 'Blackvein Mire betreten (NW)', done: false, reward: '+3 Essenz' },
    { id: 'tower', title: 'Wachturm bauen (B)', done: false },
    { id: 'mael', title: 'Inquisitor Mael stellen (Heat 50)', done: false, reward: '+6 Essenz' },
    { id: 'boss', title: 'Ashcrown binden oder besiegen (SE)', done: false, reward: 'Legende' },
    { id: 'raid', title: 'Nacht-Raid abwehren', done: false, reward: '+10 Essenz' },
    { id: 'wand', title: 'Zauberstab upgraden (U)', done: false, reward: 'Arcane Edge' },
  ];

  loadDone(ids: string[]) {
    for (const m of this.milestones) {
      if (ids.includes(m.id)) m.done = true;
    }
  }

  doneIds(): string[] {
    return this.milestones.filter((m) => m.done).map((m) => m.id);
  }

  complete(id: MilestoneId): { toast: string; rewardId?: MilestoneId } | null {
    const m = this.milestones.find((x) => x.id === id);
    if (!m || m.done) return null;
    m.done = true;
    const reward = m.reward ? ` Reward: ${m.reward}` : '';
    return { toast: `◆ Milestone: ${m.title}.${reward}`, rewardId: id };
  }

  nextObjective(): string {
    const n = this.milestones.find((m) => !m.done);
    return n ? n.title : 'Enclave secure — explore freely.';
  }

  progress(): string {
    const d = this.milestones.filter((m) => m.done).length;
    return `${d}/${this.milestones.length}`;
  }
}
