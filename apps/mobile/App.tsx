import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { phase1Modules } from "@elate/shared";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>Elate School</Text>
          <Text style={styles.title}>Parent app</Text>
          <Text style={styles.copy}>Phase 1 surfaces for linked children, attendance, timetable, announcements, and fees.</Text>

          <View style={styles.moduleList}>
            {phase1Modules
              .filter((module) => module.role === "parent")
              .map((module) => (
                <View style={styles.moduleCard} key={module.id}>
                  <Text style={styles.moduleStatus}>{module.status}</Text>
                  <Text style={styles.moduleTitle}>{module.label}</Text>
                  <Text style={styles.moduleCopy}>{module.description}</Text>
                </View>
              ))}
          </View>
        </ScrollView>
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f7f4"
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
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
  },
  moduleList: {
    width: "100%",
    gap: 12,
    marginTop: 28
  },
  moduleCard: {
    borderWidth: 1,
    borderColor: "#d8d8d2",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#ffffff"
  },
  moduleStatus: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f6b4a",
    textTransform: "uppercase"
  },
  moduleTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#17191d"
  },
  moduleCopy: {
    marginTop: 6,
    fontSize: 14,
    color: "#45484f"
  }
});
