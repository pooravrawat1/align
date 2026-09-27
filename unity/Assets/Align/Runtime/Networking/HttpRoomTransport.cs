using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Align.Networking
{
    /// <summary>
    /// Credential-free two-device fallback transport for the private demo LAN.
    /// Photon remains the intended cloud transport; this path keeps the vertical
    /// slice runnable while the login-gated Fusion SDK/App ID are unavailable.
    /// </summary>
    public sealed class HttpRoomTransport : MonoBehaviour, IAlignRoomTransport
    {
        [SerializeField] private string matcherBaseUrl = "http://192.168.1.2:4323";
        [SerializeField] private string roomCode = "DEMO";
        [SerializeField, Range(0.05f, 1f)] private float pollIntervalSeconds = 0.1f;
        [SerializeField, Range(1, 10)] private int requestTimeoutSeconds = 2;

        private LocalRoomState _localState;
        private bool _hasLocalState;
        private bool _requestInFlight;
        private bool _resetRequested;
        private float _nextPollAt;
        private string _clientId;

        public event Action<RoomStateSnapshot> SnapshotReceived;
        public event Action<string> TransportError;

        public string ClientId => _clientId ??= ResolveClientId();
        public string MatcherBaseUrl => matcherBaseUrl;
        public bool IsConnected { get; private set; }

        public void Configure(string baseUrl, string targetRoom = "DEMO")
        {
            matcherBaseUrl = (baseUrl ?? string.Empty).Trim().TrimEnd('/');
            roomCode = string.IsNullOrWhiteSpace(targetRoom)
                ? "DEMO"
                : targetRoom.Trim().ToUpperInvariant();
        }

        public void SetLocalState(in LocalRoomState state)
        {
            _localState = state;
            _hasLocalState = true;
        }

        public void RequestRoomReset()
        {
            _resetRequested = true;
            _nextPollAt = 0f;
        }

        private void Update()
        {
            if (!_hasLocalState || _requestInFlight || Time.unscaledTime < _nextPollAt)
            {
                return;
            }

            _nextPollAt = Time.unscaledTime + Mathf.Max(0.05f, pollIntervalSeconds);
            StartCoroutine(SendUpdate());
        }

        private IEnumerator SendUpdate()
        {
            _requestInFlight = true;
            bool resetRoom = _resetRequested;
            _resetRequested = false;
            var body = new RoomUpdateRequest
            {
                roomCode = roomCode,
                clientId = ClientId,
                requestedProfileId = string.IsNullOrWhiteSpace(_localState.RequestedProfileId)
                    ? "auto"
                    : _localState.RequestedProfileId,
                calibrated = _localState.Calibrated,
                pose = RoomPosePayload.FromPose(_localState.Pose, _localState.Sequence),
                resetRoom = resetRoom
            };
            byte[] bytes = Encoding.UTF8.GetBytes(JsonUtility.ToJson(body));
            string endpoint = $"{matcherBaseUrl.TrimEnd('/')}/room/update";
            using var request = new UnityWebRequest(endpoint, UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(bytes),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = Mathf.Clamp(requestTimeoutSeconds, 1, 10)
            };
            request.SetRequestHeader("Content-Type", "application/json");
            yield return request.SendWebRequest();

            _requestInFlight = false;
            if (request.result != UnityWebRequest.Result.Success)
            {
                IsConnected = false;
                TransportError?.Invoke(
                    $"Room relay unavailable ({request.responseCode}): {request.error}");
                yield break;
            }

            RoomStateSnapshot snapshot;
            try
            {
                snapshot = JsonUtility.FromJson<RoomStateSnapshot>(request.downloadHandler.text);
            }
            catch (Exception exception)
            {
                IsConnected = false;
                TransportError?.Invoke($"Invalid room response: {exception.Message}");
                yield break;
            }

            if (snapshot == null || string.IsNullOrWhiteSpace(snapshot.clientId))
            {
                IsConnected = false;
                TransportError?.Invoke("Room relay returned an empty state.");
                yield break;
            }

            IsConnected = true;
            SnapshotReceived?.Invoke(snapshot);
        }

        private static string ResolveClientId()
        {
            string id = SystemInfo.deviceUniqueIdentifier;
            if (!string.IsNullOrWhiteSpace(id) && id != SystemInfo.unsupportedIdentifier)
            {
                return id;
            }

            const string key = "align.client-id";
            id = PlayerPrefs.GetString(key, string.Empty);
            if (string.IsNullOrWhiteSpace(id))
            {
                id = Guid.NewGuid().ToString("N");
                PlayerPrefs.SetString(key, id);
                PlayerPrefs.Save();
            }
            return id;
        }
    }
}
