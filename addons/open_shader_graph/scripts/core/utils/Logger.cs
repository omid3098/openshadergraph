using Godot;

namespace OpenShaderGraph.Core.Utils
{
    public static class Logger
    {
        public enum LogLevel { Debug, Info, Warn, Error }

        // Only messages at or above this level will be printed
        public static LogLevel CurrentLevel { get; set; } = LogLevel.Info;

        /// <summary>
        /// Logs a message at the specified level if it meets the current threshold.
        /// </summary>
        public static void Log(string message, LogLevel level = LogLevel.Info)
        {
            if (level < CurrentLevel)
                return;
            GD.Print($"[{level}] {message}");
        }

        public static void Debug(string message) => Log(message, LogLevel.Debug);
        public static void Info(string message) => Log(message, LogLevel.Info);
        public static void Warn(string message) => Log(message, LogLevel.Warn);
        public static void Error(string message) => Log(message, LogLevel.Error);
    }
}