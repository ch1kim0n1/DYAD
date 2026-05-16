import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0c' },
          headerTintColor: '#e8e8ed',
          contentStyle: { backgroundColor: '#0a0a0c' },
        }}
      />
    </>
  );
}
