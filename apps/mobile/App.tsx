import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Elate School</Text>
        <Text style={styles.title}>Mobile workspace</Text>
        <Text style={styles.copy}>Expo app wired for typed tRPC calls.</Text>
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f7f7f4"
  },
  eyebrow: {
    fontSize: 14,
    color: "#575a60"
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "700",
    color: "#17191d"
  },
  copy: {
    marginTop: 8,
    fontSize: 16,
    color: "#45484f",
    textAlign: "center"
  }
});
