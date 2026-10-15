import { CheckInRecord, HourlyOccupancy, MuscleGroup, MuscleOccupancy, UserProfile } from '../types/database';
import { DEFAULT_GYM_CONFIG, GymProfileConfig } from '../config/gymConfig';

export interface LiveFloorSummary {
  isOpen: boolean;
  openingHour: number;
  closingHour: number;
  currentOccupancyCount: number;
  maxGymCapacity: number;
  occupancyPercentage: number;
  hourlyData: HourlyOccupancy[];
  muscleBreakdown: MuscleOccupancy[];
  smartSuggestion: string;
}

const BASELINE_HOURLY_WEIGHTS: Record<number, number> = {
  6: 8,   7: 22,  8: 35,  9: 25, 10: 18,
  11: 14, 12: 28, 13: 22, 14: 18, 15: 30,
  16: 55, 17: 82, 18: 96, 19: 88, 20: 68,
  21: 42, 22: 15
};

const getDegradationWeight = (checkInTimeStr: string): number => {
  const now = Date.now();
  const checkInMs = new Date(checkInTimeStr).getTime();
  const elapsedMins = Math.max(0, (now - checkInMs) / (1000 * 60));

  if (elapsedMins <= 15) return 1.0;
  if (elapsedMins <= 45) return 1.0 - 0.3 * ((elapsedMins - 15) / 30);
  if (elapsedMins <= 90) return 0.7 - 0.7 * ((elapsedMins - 45) / 45);
  return 0.0;
};

export const LiveFloorEngine = {
  calculateLiveFloor: (
    activeCheckIns: CheckInRecord[],
    userProfile?: UserProfile | null,
    gymConfig: GymProfileConfig = DEFAULT_GYM_CONFIG
  ): LiveFloorSummary => {
    const currentHour = new Date().getHours();
    const openH = gymConfig.openingHour;
    const closeH = gymConfig.closingHour;
    const capacity = gymConfig.maxGymCapacity || 80;

    // The club closes AT closingHour (22 → last open hour is 21:xx)
    const isOpen = currentHour >= openH && currentHour < closeH;

    let degradedCheckInSum = 0;
    activeCheckIns.forEach(c => {
      degradedCheckInSum += getDegradationWeight(c.checkInTime);
    });

    const hourlyData: HourlyOccupancy[] = [];
    for (let h = openH; h <= closeH; h++) {
      let count = BASELINE_HOURLY_WEIGHTS[h] || 15;

      if (h === currentHour) {
        if (activeCheckIns.length > 0) {
          count = Math.round(degradedCheckInSum * 1.2 + count * 0.3);
        }
      } else if (h === currentHour - 1) {
        count = Math.round(count * 0.9 + degradedCheckInSum * 0.4);
      }

      const percentage = Math.min(100, Math.max(5, Math.round((count / capacity) * 100)));

      hourlyData.push({
        hour: h,
        label: `${h < 10 ? '0' : ''}${h}:00`,
        occupancyCount: count,
        percentage,
        isCurrentHour: h === currentHour
      });
    }

    const currentOccupancyCount = isOpen
      ? (activeCheckIns.length > 0 ? Math.max(1, Math.round(degradedCheckInSum)) : (BASELINE_HOURLY_WEIGHTS[currentHour] || 18))
      : 0;

    const occupancyPercentage = isOpen ? Math.min(100, Math.round((currentOccupancyCount / capacity) * 100)) : 0;

    const muscleCounts: Record<MuscleGroup, number> = {
      chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, cardio: 0,
    };

    activeCheckIns.forEach(c => {
      const weight = getDegradationWeight(c.checkInTime);
      if (muscleCounts[c.muscleGroup] !== undefined) {
        muscleCounts[c.muscleGroup] += weight;
      }
    });

    // No one has scanned in yet: show an honest "no data" state instead of invented numbers.
    const hasLiveData = activeCheckIns.length > 0;
    const totalTracked = Object.values(muscleCounts).reduce((a, b) => a + b, 0) || 1;

    const muscleGroupLabels: Record<MuscleGroup, string> = {
      chest: 'Pectoraux',
      back: 'Dos',
      shoulders: 'Épaules',
      arms: 'Bras',
      legs: 'Jambes',
      cardio: 'Cardio'
    };

    const muscleBreakdown: MuscleOccupancy[] = (Object.keys(muscleCounts) as MuscleGroup[]).map(mg => {
      const cnt = Math.round(muscleCounts[mg]);
      const pct = Math.round((muscleCounts[mg] / totalTracked) * 100);
      
      let status: 'packed' | 'busy' | 'moderate' | 'open' = 'open';
      if (pct >= 30) status = 'packed';
      else if (pct >= 20) status = 'busy';
      else if (pct >= 10) status = 'moderate';

      return {
        muscleGroup: mg,
        label: muscleGroupLabels[mg],
        activeCount: cnt,
        percentage: pct,
        status
      };
    }).sort((a, b) => b.percentage - a.percentage);

    let smartSuggestion = 'Le club est ouvert. Fréquentation modérée.';
    if (!isOpen) {
      smartSuggestion = `Le club est actuellement fermé (Heures d'ouverture : ${openH}:00 - ${closeH}:00).`;
    } else if (!hasLiveData) {
      smartSuggestion = 'Personne n’a encore scanné aujourd’hui : sois le premier à valider ta présence !';
    } else {
      const busiest = muscleBreakdown[0];
      const quietest = muscleBreakdown[muscleBreakdown.length - 1];
      if (busiest && quietest) {
        smartSuggestion = `Zone ${busiest.label} très active (${busiest.percentage}%), mais la zone ${quietest.label} est fluide !`;
      }
    }

    return {
      isOpen,
      openingHour: openH,
      closingHour: closeH,
      currentOccupancyCount,
      maxGymCapacity: capacity,
      occupancyPercentage,
      hourlyData,
      muscleBreakdown,
      smartSuggestion
    };
  }
};
