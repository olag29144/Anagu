import { Stack } from 'expo-router';

export default function CitizenLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#15803d' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="submit" options={{ title: 'Submit Application' }} />
      <Stack.Screen name="status" options={{ title: 'My Applications' }} />
    </Stack>
  );
}
