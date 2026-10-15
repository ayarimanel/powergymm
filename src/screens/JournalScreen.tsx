import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { UserProfile } from '../types/database';
import { useJournalData } from '../journal/journalSync';
import { Journal } from '../journal/ui/Journal';
import { useScrollToTopOnReselect } from '../navigation/tabEvents';
import { colors } from '../theme';

interface Props {
  user: UserProfile;
  /** Bumped by the app after a check-in to start a session right away. */
  startToken?: number;
  /** Bumped to open "Mon bilan" (Accueil quick action). */
  bilanToken?: number;
}

export const JournalScreen: React.FC<Props> = ({ user, startToken, bilanToken }) => {
  const scrollRef = useScrollToTopOnReselect('machines');
  const data = useJournalData({ userId: user.id });

  if (!data.ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <Journal
      key={user.id}
      history={data.history}
      customExercises={data.customs}
      draft={data.draft}
      onDraftChange={data.saveDraft}
      onSaveWorkout={data.saveWorkout}
      onDeleteWorkout={data.deleteWorkout}
      onCreateExercise={data.createExercise}
      sync={data.sync}
      startToken={startToken}
      scrollRef={scrollRef}
      gender={user.gender}
      bilanToken={bilanToken}
    />
  );
};
