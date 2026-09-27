using UnityEngine;
using UnityEngine.UI;

namespace Align.Presentation
{
    /// <summary>
    /// Lightweight stereo-safe glass styling. Uses the standard UI shader and
    /// translucent geometry; no passthrough camera capture or blur is required.
    /// </summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class RoundedGlassPanel : MaskableGraphic
    {
        private const int CornerSteps = 12;
        private const int PointCount = (CornerSteps + 1) * 4;

        public float CornerRadius = 28f;

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            Rect rect = GetPixelAdjustedRect();
            float radius = Mathf.Min(CornerRadius, Mathf.Min(rect.width, rect.height) * 0.5f);
            if (radius <= 0f) return;

            Rect shadow = rect;
            shadow.position += new Vector2(0f, -6f);
            AddRing(vh, Expand(shadow, 8f), radius + 8f, shadow, radius,
                Color.clear, Color.clear, new Color(0f, 0f, 0f, 0.09f), new Color(0f, 0f, 0f, 0.09f));
            AddFill(vh, shadow, radius, new Color(0f, 0f, 0f, 0.09f), new Color(0f, 0f, 0f, 0.09f));

            Color top = Color.Lerp(color, Color.white, 0.32f);
            top.a = color.a;
            Color bottom = color;
            AddFill(vh, rect, radius, bottom, top);

            AddRing(vh, rect, radius, Expand(rect, -1.5f), Mathf.Max(0f, radius - 1.5f),
                new Color(1f, 1f, 1f, 0.4f), new Color(1f, 1f, 1f, 0.92f),
                new Color(1f, 1f, 1f, 0.4f), new Color(1f, 1f, 1f, 0.92f));
            // One-pixel feather removes the hard polygon edge without a custom shader.
            AddRing(vh, Expand(rect, 0.8f), radius + 0.8f, rect, radius,
                Color.clear, Color.clear,
                new Color(1f, 1f, 1f, 0.4f), new Color(1f, 1f, 1f, 0.92f));
        }

        private static Rect Expand(Rect rect, float amount) =>
            new(rect.xMin - amount, rect.yMin - amount,
                rect.width + amount * 2f, rect.height + amount * 2f);

        private static Vector2 EdgePoint(Rect rect, float radius, int index)
        {
            int corner = index / (CornerSteps + 1);
            int step = index % (CornerSteps + 1);
            float angle = (180f + corner * 90f + step * 90f / CornerSteps) * Mathf.Deg2Rad;
            Vector2 center = corner switch
            {
                0 => new Vector2(rect.xMin + radius, rect.yMin + radius),
                1 => new Vector2(rect.xMax - radius, rect.yMin + radius),
                2 => new Vector2(rect.xMax - radius, rect.yMax - radius),
                _ => new Vector2(rect.xMin + radius, rect.yMax - radius)
            };
            return center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
        }

        private static Color Gradient(Rect rect, Vector2 point, Color bottom, Color top) =>
            Color.Lerp(bottom, top, Mathf.InverseLerp(rect.yMin, rect.yMax, point.y));

        private static void AddFill(VertexHelper vh, Rect rect, float radius, Color bottom, Color top)
        {
            int start = vh.currentVertCount;
            vh.AddVert(rect.center, Color.Lerp(bottom, top, 0.5f), Vector2.zero);
            for (int i = 0; i < PointCount; i++)
            {
                Vector2 point = EdgePoint(rect, radius, i);
                vh.AddVert(point, Gradient(rect, point, bottom, top), Vector2.zero);
            }
            for (int i = 0; i < PointCount; i++)
                vh.AddTriangle(start, start + 1 + i, start + 1 + (i + 1) % PointCount);
        }

        private static void AddRing(VertexHelper vh, Rect outer, float outerRadius,
            Rect inner, float innerRadius, Color outerBottom, Color outerTop,
            Color innerBottom, Color innerTop)
        {
            int start = vh.currentVertCount;
            for (int i = 0; i < PointCount; i++)
            {
                Vector2 a = EdgePoint(outer, outerRadius, i);
                Vector2 b = EdgePoint(inner, innerRadius, i);
                vh.AddVert(a, Gradient(outer, a, outerBottom, outerTop), Vector2.zero);
                vh.AddVert(b, Gradient(inner, b, innerBottom, innerTop), Vector2.zero);
            }
            for (int i = 0; i < PointCount; i++)
            {
                int a = start + i * 2;
                int b = start + ((i + 1) % PointCount) * 2;
                vh.AddTriangle(a, b, a + 1);
                vh.AddTriangle(a + 1, b, b + 1);
            }
        }
    }
}
