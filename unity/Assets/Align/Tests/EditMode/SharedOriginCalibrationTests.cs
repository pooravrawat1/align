using Align.Calibration;
using Align.Pose;
using NUnit.Framework;
using UnityEngine;

namespace Align.Tests
{
    public sealed class SharedOriginCalibrationTests
    {
        [Test]
        public void CaptureMapsMarkerToSharedOriginAndPreservesHeadHeight()
        {
            var calibration = new SharedOriginCalibration();
            var markerPose = new HeadPoseSample(
                new Vector3(4f, 1.7f, -3f),
                Quaternion.Euler(0f, 90f, 0f),
                true,
                1d);

            calibration.Capture(markerPose);
            HeadPoseSample shared = calibration.ToShared(markerPose);

            Assert.That(shared.Position.x, Is.EqualTo(0f).Within(0.001f));
            Assert.That(shared.Position.z, Is.EqualTo(0f).Within(0.001f));
            Assert.That(shared.Position.y, Is.EqualTo(1.7f).Within(0.001f));
            Assert.That(Vector3.Angle(shared.Rotation * Vector3.forward, Vector3.forward),
                Is.LessThan(0.01f));
        }

        [Test]
        public void SharedPositionUsesCapturedYaw()
        {
            var calibration = new SharedOriginCalibration();
            calibration.Capture(new HeadPoseSample(
                new Vector3(4f, 1.7f, -3f),
                Quaternion.Euler(0f, 90f, 0f),
                true,
                1d));

            HeadPoseSample shared = calibration.ToShared(new HeadPoseSample(
                new Vector3(6f, 1.7f, -3f),
                Quaternion.Euler(0f, 90f, 0f),
                true,
                2d));

            Assert.That(shared.Position.x, Is.EqualTo(0f).Within(0.001f));
            Assert.That(shared.Position.z, Is.EqualTo(2f).Within(0.001f));
        }

        [Test]
        public void UntrackedCaptureDoesNotCalibrateAndResetClearsState()
        {
            var calibration = new SharedOriginCalibration();
            calibration.Capture(new HeadPoseSample(
                Vector3.one,
                Quaternion.identity,
                false,
                1d));
            Assert.That(calibration.IsCalibrated, Is.False);

            calibration.Capture(new HeadPoseSample(
                Vector3.one,
                Quaternion.identity,
                true,
                2d));
            Assert.That(calibration.IsCalibrated, Is.True);
            calibration.Reset();
            Assert.That(calibration.IsCalibrated, Is.False);
        }
    }
}
